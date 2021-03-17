/**
 * WordPress dependencies
 */
import { useBlockProps, BlockControls } from '@wordpress/block-editor';
import { ToolbarGroup, ToolbarButton } from '@wordpress/components';
import { update as updateIcon } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useCallback } from '@wordpress/element';

/**
 * Internal dependencies
 */
import LegacyWidgetEditPlaceholder from './placeholder';
import LegacyWidgetEditForm from './form';
import LegacyWidgetEditPreview from './preview';

export default function LegacyWidgetEdit( {
	attributes: { id, idBase, instance },
	setAttributes,
} ) {
	const blockProps = useBlockProps();
	const [ isPreview, setIsPreview ] = useState( false );
	const setInstance = useCallback(
		( newInstance ) => setAttributes( { instance: newInstance } ),
		[ setAttributes ]
	);

	if ( ! id && ! idBase ) {
		return (
			<div { ...blockProps }>
				<LegacyWidgetEditPlaceholder
					widgetTypeId={ id ?? idBase }
					onSelectWidgetType={ ( { widgetTypeId, isMulti } ) => {
						if ( ! widgetTypeId ) {
							setAttributes( {
								id: null,
								idBase: null,
								instance: null,
							} );
						} else if ( isMulti ) {
							setAttributes( {
								id: null,
								idBase: widgetTypeId,
								instance: {},
							} );
						} else {
							setAttributes( {
								id: widgetTypeId,
								idBase: null,
								instance: null,
							} );
						}
					} }
				/>
			</div>
		);
	}

	return (
		<div { ...blockProps }>
			<BlockControls>
				<ToolbarGroup>
					{ /* TODO: Hide this if widget is hidden. */ }
					<ToolbarButton
						label={ __( 'Change widget' ) }
						icon={ updateIcon }
						onClick={ () =>
							setAttributes( {
								id: null,
								idBase: null,
								instance: null,
							} )
						}
					/>
					{ idBase && (
						<>
							<ToolbarButton
								className="components-tab-button"
								isPressed={ ! isPreview }
								onClick={ () => setIsPreview( false ) }
							>
								<span>{ __( 'Edit' ) }</span>
							</ToolbarButton>
							<ToolbarButton
								className="components-tab-button"
								isPressed={ isPreview }
								onClick={ () => setIsPreview( true ) }
							>
								<span>{ __( 'Preview' ) }</span>
							</ToolbarButton>
						</>
					) }
				</ToolbarGroup>
			</BlockControls>

			<LegacyWidgetEditForm
				id={ id }
				idBase={ idBase }
				instance={ instance }
				isVisible={ ! isPreview }
				setInstance={ setInstance }
			/>

			{ idBase && (
				<LegacyWidgetEditPreview
					idBase={ idBase }
					instance={ instance }
					isVisible={ isPreview }
				/>
			) }
		</div>
	);
}
