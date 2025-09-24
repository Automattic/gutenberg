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

const Y_MAP_KEY = 'text-map';
const Y_TEXT_KEY = 'text';
const TEMPORARY_Y_TEXT_KEY = 'text-update';

/**
 * YTextAdapter class that encapsulates Y.Text operations and provides
 * a bridge between Y.Text and RichTextValue formats.
 */
export class YTextAdapter {
	private yDoc: Y.Doc;
	private yTextMap: Y.Map< Y.Text >;
	private yText: Y.Text;

	/**
	 * Create a new YTextAdapter instance.
	 * @param initialValue
	 */
	constructor( initialValue?: RichTextValue ) {
		// Create a new Y.Doc for the adapter. A root Y.Doc is needed to
		// use the Y.Text API.
		this.yDoc = new Y.Doc();

		// Create a map we can use to store Y.Text instances.
		this.yTextMap = this.yDoc.getMap( Y_MAP_KEY );

		if ( initialValue ) {
			const richTextHtml = toHTMLString( { value: initialValue } );
			this.yText = new Y.Text( richTextHtml );
		} else {
			this.yText = new Y.Text();
		}

		this.yTextMap.set( Y_TEXT_KEY, this.yText );
	}

	/**
	 * Get the current RichTextValue representation.
	 */
	getRichTextValue(): RichTextValue {
		const yValue = this.yText.toJSON();
		const richTextValue = create( { html: yValue } );
		return richTextValue;
	}

	/**
	 * Handle changes from the RichText component and apply them to Y.Text.
	 * @param newRecord The new RichTextValue to apply
	 */
	handleChange( newRecord: RichTextValue ): void {
		// Y.Text must be attached to a Y.Doc to be able to do operations on it.
		// Create a temporary Y.Text attached to the local Y.Doc for delta computation.
		const newValue = toHTMLString( { value: newRecord } );
		const newYText = this.yTextMap.set(
			TEMPORARY_Y_TEXT_KEY,
			new Y.Text( newValue )
		);

		const currentValueAsDelta = new Delta( this.yText.toDelta() );
		const updatedValueAsDelta = new Delta( newYText.toDelta() );

		// TODO: We can pass in the pre-change cursor position as a hint to diff(), but
		// newRecord's start and end are the after-change position.
		// See if we can keep a copy of the prior selection position and use it here.
		const deltaDiff = currentValueAsDelta.diff( updatedValueAsDelta );

		this.yText.applyDelta( deltaDiff.ops );
		console.log( 'yText after change:', this.yText.toJSON() );

		// Clean up the temporary Y.Text instance.
		this.yTextMap.delete( TEMPORARY_Y_TEXT_KEY );
	}
}
