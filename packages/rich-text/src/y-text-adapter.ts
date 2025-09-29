/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import { Y } from '@wordpress/sync';

/**
 * Internal dependencies
 */
import type { RichTextValue } from './types';
import { create } from './create';
import { toHTMLString } from './to-html-string';
import Delta from 'quill-delta';
import { addAction } from '@wordpress/hooks';

/**
 * YTextAdapter class that encapsulates Y.Text operations and provides
 * a bridge between Y.Text and RichTextValue formats.
 */
export class YTextAdapter {
	/* The Y.Text instance that is shared with other users. */
	private sharedYText: Y.Text | undefined;
	private clientId: string;

	/**
	 * Create a new YTextAdapter instance.
	 * @param clientId
	 */
	constructor( clientId: string ) {
		this.clientId = clientId;
		// // Create a new Y.Doc for the adapter. A root Y.Doc is needed to
		// // use the Y.Text API with the temporary Y.Text instance.
		// this.yDoc = new Y.Doc();
		// this.previousYTextValue = this.yDoc.getText( INTERNAL_Y_TEXT_KEY );

		if ( 'post-title' === clientId ) {
			// ydoc.get('title') needs to be converted into a Y.Text instance.
			return;
		}

		const yText = yTextMap.get( clientId );

		if ( yText === undefined ) {
			throw new Error(
				'YTextAdapter: No Y.Text instance found for clientId: ' +
					clientId
			);
		} else {
			this.sharedYText = yText;
		}
	}

	/**
	 * Get the current RichTextValue representation.
	 */
	getRichTextValue(): RichTextValue {
		if ( ! this.sharedYText ) {
			// This can happen for the post-title block.
			return create( { html: 'dummy-value' } );
		}
		const yValue = this.sharedYText.toJSON();
		const richTextValue = create( { html: yValue } );
		return richTextValue;
	}

	/**
	 * Handle changes from the RichText component and apply them to Y.Text.
	 * @param newRecord The new RichTextValue to apply
	 */
	handleChange( newRecord: RichTextValue ): void {
		if ( ! this.sharedYText ) {
			return;
		}

		const newHtml = toHTMLString( { value: newRecord } );
		const newYText = new Y.Text( newHtml );

		// Y.Text must be attached to a Y.Doc to be able to do operations on it.
		// Create a temporary Y.Text attached to a local Y.Doc for delta computation.
		const localYDoc = new Y.Doc();
		const localMap = localYDoc.getMap( 'map' );
		localMap.set( 'local-text', newYText );

		const currentValueAsDelta = new Delta( this.sharedYText.toDelta() );
		const updatedValueAsDelta = new Delta( newYText.toDelta() );

		// TODO: We can pass in the pre-change cursor position as a hint to diff(), but
		// newRecord's start and end are the after-change position.
		// See if we can keep a copy of the prior selection position and use it here.
		const deltaDiff = currentValueAsDelta.diff( updatedValueAsDelta );

		console.log( 'Applying delta to sharedYText:', {
			diff: deltaDiff.ops,
		} );
		this.sharedYText.applyDelta( deltaDiff.ops );
	}
}

// Temporary: Gather Y.Text instances
const yTextMap = new Map< string, Y.Text >();

addAction(
	'sync.broadcastYTextInstance',
	'YTextAdapter',
	( { clientId, yText } ) => {
		yTextMap.set( clientId, yText );
	}
);
