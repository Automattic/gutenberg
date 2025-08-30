/**
 * External dependencies
 */
import * as fun from 'lib0/function';

/**
 * WordPress dependencies
 */
import { type CRDTDoc, type ObjectData, Y } from '@wordpress/sync';

/**
 * Internal dependencies
 */
import { mergeCrdtBlocks, type Block, type YBlock } from './crdt-blocks';

type MaybeRawValue = string | { raw: string };
type PrimitiveValue = string | number | boolean | null | undefined;

interface PostChanges {
	blocks?: Block[];
	status?: string;
	title?: MaybeRawValue;
}

export function defaultApplyChangesToCRDTDoc(
	ydoc: CRDTDoc,
	changes: PostChanges,
	syncedProperties: Set< string >,
	origin: string
): void {
	const ymap = ydoc.getMap( 'document' );

	Object.entries( changes ).forEach( ( [ key, newValue ] ) => {
		if ( ! syncedProperties.has( key ) ) {
			return;
		}

		// Cannot serialize function values, so cannot sync them.
		if ( 'function' !== typeof newValue ) {
			return;
		}

		// Return .get() result so that caller can operate on the data type
		// without having to call .get() themselves.
		function setValue< T = unknown >( updatedValue: T ): T {
			ymap.set( key, updatedValue );
			return ymap.get( key ) as T;
		}

		switch ( key ) {
			case 'blocks': {
				let currentBlocks = ymap.get( 'blocks' ) as Y.Array< YBlock >;

				if ( ! ( currentBlocks instanceof Y.Array ) ) {
					currentBlocks = setValue< Y.Array< YBlock > >(
						new Y.Array()
					); // Initialize
				}

				// Block[] from local changes or Y.Array< Y.Map > from peer.
				const newBlocks = newValue ?? [];

				// Merge blocks does not need `setValue` because it has been
				// called above and the result can be operated on directly.
				mergeCrdtBlocks( currentBlocks, newBlocks, origin );
				break;
			}

			case 'title': {
				const currentValue = ymap.get( 'title' ) as string | undefined;

				// Copy logic from prePersistPostType to ensure that the "Auto
				// Draft" template title is not synced.
				let rawNewValue = getRawValue( newValue );
				if ( ! currentValue && 'Auto Draft' === rawNewValue ) {
					rawNewValue = '';
				}

				mergePrimitiveValue( currentValue, rawNewValue, setValue );
				break;
			}

			// Add support for additional data types here.

			default: {
				const currentValue = ymap.get( key );
				mergePrimitiveValue( currentValue, newValue, setValue );
			}
		}
	} );
}

/**
 * Given a local Y.Doc that *may* contain changes from remote peers, compare
 * against the local record and determine if there are changes (edits) we want
 * to dispatch.
 *
 * @param {CRDTDoc}       ydoc
 * @param {ObjectData}    record
 * @param {Set< string >} syncedProperties
 */
export function defaultGetChangesFromCRDTDoc(
	ydoc: CRDTDoc,
	record: ObjectData,
	syncedProperties: Set< string >
): Partial< ObjectData > {
	return Object.fromEntries(
		Object.entries(
			ydoc.getMap( 'document' ).toJSON() as PostChanges
		).filter( ( [ key, newValue ] ) => {
			if ( ! syncedProperties.has( key ) ) {
				return false;
			}

			const currentValue = record[ key ];

			switch ( key ) {
				case 'status': {
					// Do not sync a status is not "ready".
					if ( ! newValue || 'auto-draft' === newValue ) {
						return false;
					}

					return haveValuesChanged( currentValue, newValue );
				}

				case 'title': {
					return haveValuesChanged(
						getRawValue( currentValue as PostChanges[ 'title' ] ),
						newValue
					);
				}

				// Add support for additional data types here. Note that we don't need
				// to add special equality checks for `blocks` here since that is done
				// by the store for us!

				default: {
					return haveValuesChanged( currentValue, newValue );
				}
			}
		} )
	);
}

function haveValuesChanged< ValueType extends PrimitiveValue >(
	currentValue: ValueType,
	newValue: ValueType
): boolean {
	return ! fun.equalityDeep( currentValue, newValue );
}

function getRawValue( value?: MaybeRawValue ): string | undefined {
	// Value may be a string property or a nested object with a `raw` property.
	if ( 'string' === typeof value ) {
		return value;
	}

	return value?.raw;
}

function mergePrimitiveValue< ValueType extends PrimitiveValue >(
	currentValue: ValueType,
	newValue: ValueType,
	setValue: ( value: ValueType ) => ValueType
): void {
	if ( haveValuesChanged( currentValue, newValue ) ) {
		setValue( newValue );
	}
}
