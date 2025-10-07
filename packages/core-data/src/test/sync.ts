/**
 * External dependencies
 */
import {
	describe,
	expect,
	it,
	jest,
	beforeEach,
	afterEach,
} from '@jest/globals';

/**
 * Mock @wordpress/hooks
 */
jest.mock( '@wordpress/hooks', () => ( {
	applyFilters: jest.fn( () => null ),
} ) );

/**
 * Mock @wordpress/sync
 */
jest.mock( '@wordpress/sync', () => {
	return {
		SyncProvider: jest.fn(),
		getWebRTCSyncProvider: jest.fn(),
	};
} );

/**
 * Internal dependencies
 */
import { getSyncProvider } from '../sync';

/**
 * WordPress dependencies
 */
import { getWebRTCSyncProvider, SyncProvider } from '@wordpress/sync';

describe( 'sync', () => {
	beforeEach( () => {
		// Clear all mocks before each test
		jest.clearAllMocks();

		// Reset window.__experimentalEnableSync
		delete window.__experimentalEnableSync;
	} );

	afterEach( () => {
		// Clean up window properties
		delete window.__experimentalEnableSync;
	} );

	describe( 'getSyncProvider', () => {
		it( 'returns a sync provider instance', () => {
			const provider = getSyncProvider();

			expect( provider ).toBeInstanceOf( SyncProvider );
			expect( provider ).toBeDefined();
			expect( getWebRTCSyncProvider ).not.toHaveBeenCalled();
		} );

		it( 'returns the same provider instance on subsequent calls (caching)', () => {
			const provider1 = getSyncProvider();
			const provider2 = getSyncProvider();
			const provider3 = getSyncProvider();

			expect( provider1 ).toBe( provider2 );
			expect( provider2 ).toBe( provider3 );
			expect( getWebRTCSyncProvider ).not.toHaveBeenCalled();
		} );

		it( 'provider is not null or undefined', () => {
			const provider = getSyncProvider();

			expect( provider ).not.toBeNull();
			expect( provider ).not.toBeUndefined();
			expect( getWebRTCSyncProvider ).not.toHaveBeenCalled();
		} );

		it( 'provider has expected structure', () => {
			const provider = getSyncProvider();

			// Provider should be an instance of SyncProvider
			expect( provider ).toBeInstanceOf( SyncProvider );
			expect( getWebRTCSyncProvider ).not.toHaveBeenCalled();
		} );

		it( 'uses WebRTC sync provider when experimental flag is set and no provider from filter', () => {
			jest.isolateModules( () => {
				window.__experimentalEnableSync = true;
				// eslint-disable-next-line @typescript-eslint/no-shadow
				const { getSyncProvider } = require( '../sync' );
				const provider = getSyncProvider();

				expect( provider ).toBeInstanceOf( SyncProvider );
				expect( getWebRTCSyncProvider ).toHaveBeenCalled();
			} );
		} );
	} );
} );
