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

jest.mock( '../connect-indexdb', () => ( {
	connectIndexDb: jest.fn(),
} ) );

jest.mock( '../create-webrtc-connection', () => ( {
	createWebRTCConnection: jest.fn( () => jest.fn() ),
} ) );

/**
 * Internal dependencies
 */
import { getWebRTCSyncProvider, SyncProvider } from '../index';
import { createWebRTCConnection } from '../create-webrtc-connection';

describe( 'getWebRTCSyncProvider', () => {
	const mockCreateWebRTC = createWebRTCConnection as jest.Mock;

	beforeEach( () => {
		jest.clearAllMocks();
	} );

	afterEach( () => {
		delete ( globalThis.window as any )
			.__experimentalCollaborativeEditingSecret;
		delete ( globalThis.window as any ).wp;
	} );

	it( 'creates a SyncProvider instance', () => {
		const provider = getWebRTCSyncProvider();

		expect( provider ).toBeInstanceOf( SyncProvider );
	} );

	it( 'passes window password and signaling URL to createWebRTCConnection', () => {
		globalThis.window.__experimentalCollaborativeEditingSecret =
			'test-secret';
		globalThis.window.wp = {
			ajax: { settings: { url: 'https://example.com' } },
		};

		getWebRTCSyncProvider();

		expect( mockCreateWebRTC ).toHaveBeenCalledWith( {
			password: 'test-secret',
			signaling: [ 'https://example.com' ],
		} );
	} );

	it( 'handles missing window properties gracefully', () => {
		getWebRTCSyncProvider();

		expect( mockCreateWebRTC ).toHaveBeenCalledWith( {
			password: undefined,
			signaling: [ undefined ],
		} );
	} );

	it( 'creates new provider instance on each call', () => {
		const provider1 = getWebRTCSyncProvider();
		const provider2 = getWebRTCSyncProvider();

		expect( provider1 ).not.toBe( provider2 );
	} );
} );
