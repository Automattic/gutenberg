/**
 * External dependencies
 */
import { WebsocketProvider } from 'y-websocket';

/**
 * Internal dependencies
 */
import type { ConnectDoc, Y } from './types';

type WebsocketProviderConstructorArgs = ConstructorParameters<
	typeof WebsocketProvider
>;

interface WebSocketConnectionConfig {
	options?: WebsocketProviderConstructorArgs[ 3 ];
	password?: string;
	serverUrl: string;
	configureProvider?: (
		provider: WebsocketProvider,
		syncObjectType: string,
		syncObjectId: string
	) => Promise< void >;
}

/**
 * Function that creates a new WebSocket Connection.
 *
 * @param {WebSocketConnectionConfig} config The configuration for the WebSocket connection.
 * @return {ConnectDoc} A function that connects a Y.Doc to a WebSocket server.
 */
export function createWebSocketConnection(
	config: WebSocketConnectionConfig
): ConnectDoc {
	return async function ( objectId: string, objectType: string, doc: Y.Doc ) {
		const roomName = `${ objectType }-${ objectId }`;
		let provider = null;

		try {
			provider = new WebsocketProvider( config.serverUrl, roomName, doc, {
				...config.options,
			} );

			/**
			 * Perform any additional configuration of the provider before returning.
			 */
			if ( config.configureProvider ) {
				await config.configureProvider(
					provider,
					objectType,
					objectId
				);
			}
		} catch {}

		return {
			awareness: provider?.awareness || null,
			destroy: () => {
				// The WebsocketProvider handles its own cleanup. If needed, we could
				// implement a way to disconnect or clean up resources here.
			},
		};
	};
}
