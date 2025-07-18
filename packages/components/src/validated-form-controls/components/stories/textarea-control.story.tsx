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
import { ValidatedTextareaControl } from '../textarea-control';

const meta: Meta< typeof ValidatedTextareaControl > = {
	title: 'Components (Experimental)/Validated Form Controls/ValidatedTextareaControl',
	component: ValidatedTextareaControl,
	tags: [ 'status-private' ],
	decorators: formDecorator,
	args: { onChange: () => {} },
	argTypes: { value: { control: false } },
};
export default meta;

export const Default: StoryObj< typeof ValidatedTextareaControl > = {
	render: function Template( { onChange, ...args } ) {
		const [ value, setValue ] = useState( '' );

		return (
			<ValidatedTextareaControl
				{ ...args }
				onChange={ ( newValue ) => {
					setValue( newValue );
					onChange?.( newValue );
				} }
				value={ value }
			/>
		);
	},
};
Default.args = {
	required: true,
	label: 'Textarea',
	help: 'The word "error" will trigger an error.',
	customValidator: ( value ) => {
		if ( value?.toLowerCase() === 'error' ) {
			return 'The word "error" is not allowed.';
		}
		return undefined;
	},
};
