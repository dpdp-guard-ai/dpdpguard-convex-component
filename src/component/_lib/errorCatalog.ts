import catalog from "@dpdpguard/contract/conformance/error-catalog.json";

/**
 * ADR-002 D2's typed error-code enum, loaded from the installed
 * @dpdpguard/contract package rather than hand-copied here — a contract
 * upgrade that adds a code is a version bump away, not a manual edit.
 * (Convex's bundler statically resolves JSON imports at deploy time, so
 * this doesn't need the Node SDK's `createRequire` CJS/ESM workaround.)
 */
export interface ErrorCatalogEntry {
	code: string;
	description: string;
}

export const ERROR_CATALOG: ErrorCatalogEntry[] = (
	catalog as { codes: ErrorCatalogEntry[] }
).codes;

export type ApiErrorCode =
	| "MINOR_TRACKING_BLOCKED"
	| "NOTICE_NOT_PUBLISHED"
	| "ALREADY_CONSENTED"
	| "NOT_ASSOCIATED_WITH_ORG"
	| "INVALID_STATUS_TRANSITION"
	| "SDK_VERSION_UNSUPPORTED"
	| "NOT_FOUND"
	| "UNAUTHORIZED"
	| "RATE_LIMITED"
	| "VALIDATION_ERROR";

/** Thrown for any non-2xx `/api/v1` response — matches @dpdpguard/server's DpdpGuardApiError shape. */
export class DpdpGuardApiError extends Error {
	readonly code: ApiErrorCode | string;
	readonly status: number;

	constructor(code: ApiErrorCode | string, message: string, status: number) {
		super(message);
		this.name = "DpdpGuardApiError";
		this.code = code;
		this.status = status;
	}
}
