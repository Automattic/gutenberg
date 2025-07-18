/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';

/**
 * External dependencies
 */
import type { StoryObj, Meta } from '@storybook/react';

/**
 * Internal dependencies
 */
import { formDecorator } from './story-utils';
import { ValidatedTextControl } from '../text-control';

const meta: Meta< typeof ValidatedTextControl > = {
	title: 'Components (Experimental)/Validated Form Controls/ValidatedTextControl',
	component: ValidatedTextControl,
	tags: [ 'status-private' ],
	decorators: formDecorator,
	args: { onChange: () => {} },
	argTypes: {
		value: { control: false },
	},
};
export default meta;

export const Default: StoryObj< typeof ValidatedTextControl > = {
	render: function Template( { onChange, ...args } ) {
		const [ value, setValue ] = useState( '' );

		return (
			<ValidatedTextControl
				{ ...args }
				value={ value }
				onChange={ ( newValue ) => {
					setValue( newValue );
					onChange?.( newValue );
				} }
			/>
		);
	},
};
Default.args = {
	required: true,
	label: 'Text',
	help: "The word 'error' will trigger an error.",
	customValidator: ( value ) => {
		if ( value?.toString().toLowerCase() === 'error' ) {
			return 'The word "error" is not allowed.';
		}
		return undefined;
	},
};
