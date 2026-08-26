import Foundation
import Capacitor
import StoreKit

/// The auto-renewable subscription product id created in App Store
/// Connect (Monetization → Subscriptions) — must exactly match
/// APPLE_PRO_MONTHLY_PRODUCT_ID in src/definitions.ts. Only one paid tier
/// exists in this app, so this is a constant rather than a parameter
/// threaded through every method.
private let proMonthlyProductId = "com.peaceofmine.baby.pro.monthly"

enum AppleIAPError: LocalizedError {
    case failedVerification
    case unknownProduct

    var errorDescription: String? {
        switch self {
        case .failedVerification:
            return "Apple could not verify this transaction's signature"
        case .unknownProduct:
            return "The Pro subscription product was not found in the App Store"
        }
    }
}

/// Capacitor bridge for StoreKit 2 — purchases the app's single Pro
/// subscription product and reports transactions back to JS, which is
/// responsible for confirming them with the server (verifyAppleTransaction
/// in src/utils/appleIap.functions.ts) before treating Pro as unlocked.
/// This plugin deliberately does the minimum StoreKit-side: it never
/// decides entitlement itself, since a client-side "the purchase
/// succeeded" claim is not something the server should ever trust on its
/// own (see appleIap.server.ts's doc comment on transactionToSubscriptionRow).
///
/// Registered via CAPBridgedPlugin, matching VisionBarcodeScannerPlugin's
/// pattern (works under both CocoaPods and Swift Package Manager).
@objc(AppleIAPPlugin)
public class AppleIAPPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleIAPPlugin"
    public let jsName = "AppleIAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
    ]

    private var updatesTask: Task<Void, Never>?

    @objc override public func load() {
        // Transaction.updates delivers renewals, and purchases resolved
        // after being pending (e.g. Ask to Buy approval) or made on
        // another of the user's devices — none of which happen inside a
        // purchase() call, so this has to be observed for as long as the
        // plugin exists, not just while a purchase is in flight.
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                await self?.handle(update: update)
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc func getProduct(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: [proMonthlyProductId])
                guard let product = products.first else {
                    call.reject(AppleIAPError.unknownProduct.localizedDescription)
                    return
                }
                call.resolve([
                    "id": product.id,
                    "displayName": product.displayName,
                    "description": product.description,
                    "price": NSDecimalNumber(decimal: product.price).doubleValue,
                    "displayPrice": product.displayPrice,
                ])
            } catch {
                call.reject("Could not load the Pro subscription product: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let appAccountTokenString = call.getString("appAccountToken"),
              let appAccountToken = UUID(uuidString: appAccountTokenString) else {
            call.reject("A valid appAccountToken (the signed-in user's id) is required")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [proMonthlyProductId])
                guard let product = products.first else {
                    call.reject(AppleIAPError.unknownProduct.localizedDescription)
                    return
                }

                let result = try await product.purchase(options: [.appAccountToken(appAccountToken)])

                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    await transaction.finish()
                    call.resolve(resultPayload(for: transaction))
                case .userCancelled:
                    call.reject("Purchase cancelled", "userCancelled")
                case .pending:
                    call.reject(
                        "Purchase is pending approval (e.g. Ask to Buy) and hasn't completed yet",
                        "pending"
                    )
                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()

                var transactions: [[String: Any]] = []
                for await result in Transaction.currentEntitlements {
                    guard let transaction = try? checkVerified(result) else { continue }
                    transactions.append(resultPayload(for: transaction))
                }
                call.resolve(["transactions": transactions])
            } catch {
                call.reject("Could not restore purchases: \(error.localizedDescription)")
            }
        }
    }

    private func handle(update: VerificationResult<Transaction>) async {
        guard let transaction = try? checkVerified(update) else { return }
        notifyListeners("transactionUpdate", data: resultPayload(for: transaction))
        await transaction.finish()
    }

    private func resultPayload(for transaction: Transaction) -> [String: Any] {
        [
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "productId": transaction.productID,
            "environment": transaction.environment == .sandbox ? "sandbox" : "live",
        ]
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw AppleIAPError.failedVerification
        case .verified(let safe):
            return safe
        }
    }
}
