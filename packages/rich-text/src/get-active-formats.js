/** @typedef {import('./types').RichTextValue} RichTextValue */
/** @typedef {import('./types').RichTextFormatList} RichTextFormatList */

/**
 * Internal dependencies
 */
import { isFormatEqual } from './is-format-equal';

/**
 * Gets the all format objects at the start of the selection.
 *
 * @param {RichTextValue} value                Value to inspect.
 * @param {Array}         EMPTY_ACTIVE_FORMATS Array to return if there are no
 *                                             active formats.
 *
 * @return {RichTextFormatList} Active format objects.
 */
export function getActiveFormats( value, EMPTY_ACTIVE_FORMATS = [] ) {
	const { formats, start, end, activeFormats } = value;
	if ( start === undefined ) {
		return EMPTY_ACTIVE_FORMATS;
	}

	if ( start === end ) {
		// For a collapsed caret, it is possible to override the active formats.
		if ( activeFormats ) {
			// Filter out editor-only formats (like annotations) from activeFormats.
			return activeFormats.filter(
				( format ) => format.type !== 'core/annotation'
			);
		}

		const formatsBefore = formats[ start - 1 ] || EMPTY_ACTIVE_FORMATS;
		const formatsAfter = formats[ start ] || EMPTY_ACTIVE_FORMATS;

		// Filter out editor-only formats (like annotations) when calculating from formats.
		const filteredFormatsBefore = formatsBefore.filter(
			( format ) => format.type !== 'core/annotation'
		);
		const filteredFormatsAfter = formatsAfter.filter(
			( format ) => format.type !== 'core/annotation'
		);

		// By default, select the lowest amount of formats possible (which means
		// the caret is positioned outside the format boundary). The user can
		// then use arrow keys to define `activeFormats`.
		if ( filteredFormatsBefore.length < filteredFormatsAfter.length ) {
			return filteredFormatsBefore;
		}

		return filteredFormatsAfter;
	}

	// If there's no formats at the start index, there are not active formats.
	if ( ! formats[ start ] ) {
		return EMPTY_ACTIVE_FORMATS;
	}

	const selectedFormats = formats.slice( start, end );

	let i = selectedFormats.length;
	let _activeFormats;

	// For performance reasons, start from the end where it's much quicker to
	// realise that there are no active formats.
	while ( i-- ) {
		const formatsAtIndex = selectedFormats[ i ];

		// If we run into any index without formats, we're sure that there's no
		// active formats.
		if ( ! formatsAtIndex ) {
			return EMPTY_ACTIVE_FORMATS;
		}

		// Filter out editor-only formats (like annotations) from formats at this index.
		const filteredFormatsAtIndex = formatsAtIndex.filter(
			( format ) => format.type !== 'core/annotation'
		);

		// Clone the formats so we're not mutating the live value.
		// Filter out editor-only formats (like annotations) from the start.
		// Assign only when we know we'll use it (after early return check).
		if ( _activeFormats === undefined ) {
			_activeFormats = ( selectedFormats[ 0 ] || [] ).filter(
				( format ) => format.type !== 'core/annotation'
			);
		}
		let ii = _activeFormats.length;

		// Loop over the active formats and remove any that are not present at
		// the current index.
		while ( ii-- ) {
			const format = _activeFormats[ ii ];

			if (
				! filteredFormatsAtIndex.find( ( _format ) =>
					isFormatEqual( format, _format )
				)
			) {
				_activeFormats.splice( ii, 1 );
			}
		}

		// If there are no active formats, we can stop.
		if ( _activeFormats.length === 0 ) {
			return EMPTY_ACTIVE_FORMATS;
		}
	}

	return _activeFormats || EMPTY_ACTIVE_FORMATS;
}
