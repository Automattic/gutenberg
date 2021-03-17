/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { widget as icon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import metadata from './block.json';
import edit from './edit';

const { name } = metadata;
export { metadata, name };

export const settings = {
	title: __( 'Legacy Widget' ),
	description: __( 'Display a legacy widget.' ),
	icon,
	edit,
};
