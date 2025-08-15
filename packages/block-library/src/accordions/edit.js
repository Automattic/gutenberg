/**
 * WordPress dependencies
 */
import {
	useBlockProps,
	useInnerBlocksProps,
	InspectorControls,
} from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import {
	PanelBody,
	ToggleControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';

const ACCORDION_BLOCK_NAME = 'core/accordion-item';
const ACCORDION_BLOCK = {
	name: ACCORDION_BLOCK_NAME,
};

export default function Edit( {
	attributes: { autoclose, iconPosition, showIcon },
	setAttributes,
} ) {
	const blockProps = useBlockProps();

	const innerBlocksProps = useInnerBlocksProps( blockProps, {
		template: [ [ ACCORDION_BLOCK_NAME ], [ ACCORDION_BLOCK_NAME ] ],
		defaultBlock: ACCORDION_BLOCK,
		directInsert: true,
		templateInsertUpdatesSelection: true,
	} );

	return (
		<>
			<InspectorControls key="setting">
				<PanelBody title={ __( 'Settings' ) } initialOpen>
					<ToggleControl
						isBlock
						__nextHasNoMarginBottom
						label={ __( 'Auto-close' ) }
						onChange={ ( value ) => {
							setAttributes( {
								autoclose: value,
							} );
						} }
						checked={ autoclose }
						help={ __(
							'Automatically close accordions when a new one is opened.'
						) }
					/>
					<ToggleControl
						isBlock
						__nextHasNoMarginBottom
						label={ __( 'Show icon' ) }
						onChange={ ( value ) => {
							setAttributes( {
								showIcon: value,
							} );
						} }
						checked={ showIcon }
						help={ __(
							'Display a plus icon next to the accordion header.'
						) }
					/>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						isBlock
						label={ __( 'Icon Position' ) }
						value={ iconPosition }
						onChange={ ( value ) => {
							setAttributes( { iconPosition: value } );
						} }
					>
						<ToggleGroupControlOption label="Left" value="left" />
						<ToggleGroupControlOption label="Right" value="right" />
					</ToggleGroupControl>
				</PanelBody>
			</InspectorControls>
			<div { ...innerBlocksProps } />
		</>
	);
}
