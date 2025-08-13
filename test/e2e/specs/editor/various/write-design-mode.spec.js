/**
 * WordPress dependencies
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'Write/Design mode', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.activateTheme( 'emptytheme' );
	} );
	test.beforeEach( async ( { admin, page } ) => {
		await page.addInitScript( () => {
			window.__experimentalEditorWriteMode = true;
		} );
		await admin.visitSiteEditor( {
			postId: 'emptytheme//index',
			postType: 'wp_template',
			canvas: 'edit',
		} );
	} );
	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.activateTheme( 'twentytwentyone' );
	} );
	test( 'Should prevent selecting intermediary blocks', async ( {
		editor,
		page,
	} ) => {
		// Clear all content
		await editor.setContent( '' );

		// Insert a section with a nested block and an editable block.
		await editor.insertBlock( {
			name: 'core/group',
			attributes: {
				style: {
					spacing: {
						padding: '20px',
					},
					color: {
						background: 'darkgray',
					},
				},
			},
			innerBlocks: [
				{
					name: 'core/group',
					attributes: {
						style: {
							spacing: {
								padding: '20px',
							},
							color: {
								background: 'lightgray',
							},
						},
					},
					innerBlocks: [
						{
							name: 'core/paragraph',
							attributes: {
								content: 'Something',
							},
						},
					],
				},
			],
		} );

		// Switch to write mode.
		await editor.switchEditorTool( 'Write' );

		const sectionBlock = editor.canvas
			.getByRole( 'document', {
				name: 'Block: Group',
			} )
			.nth( 0 );
		const sectionClientId = await sectionBlock.getAttribute( 'data-block' );
		const nestedGroupBlock = sectionBlock.getByRole( 'document', {
			name: 'Block: Group',
		} );
		const paragraph = nestedGroupBlock.getByRole( 'document', {
			name: 'Block: Paragraph',
		} );
		const paragraphClientId = await paragraph.getAttribute( 'data-block' );

		// We should not be able to select the intermediary group block.
		// if we try to click on it (the padding area)
		// The selection should land on the top level block.
		const nestedGroupPosition = await nestedGroupBlock.boundingBox();
		await page.mouse.click(
			nestedGroupPosition.x + 5,
			nestedGroupPosition.y + 5
		);

		const getSelectedBlock = async () =>
			await page.evaluate( () =>
				window.wp.data
					.select( 'core/block-editor' )
					.getSelectedBlockClientId()
			);

		expect( await getSelectedBlock() ).toEqual( sectionClientId );

		// open the block toolbar more settings menu
		await page.getByLabel( 'Block tools' ).getByLabel( 'Options' ).click();

		// get the length of the options menu
		const optionsMenu = page
			.getByRole( 'menu', { name: 'Options' } )
			.getByRole( 'menuitem' );

		// we expect 4 items in the options menu (Cut and Copy are hidden in Write Mode)
		await expect( optionsMenu ).toHaveCount( 4 );

		// We should be able to select the paragraph block and write in it.
		await paragraph.click();
		await page.keyboard.type( ' something' );
		expect( await getSelectedBlock() ).toEqual( paragraphClientId );
		await expect( paragraph ).toHaveText( 'Something something' );

		// Check that the inspector still shows the group block with the content panel.
		await editor.openDocumentSettingsSidebar();
		const editorSettings = page.getByRole( 'region', {
			name: 'Editor settings',
		} );
		await expect(
			// Ideally we should not be using CSS selectors
			// but in this case there's no easy role/label
			// to retrieve the "selected block title"
			editorSettings.locator( '.block-editor-block-card__title' )
		).toHaveText( 'Group' );
		await expect(
			editorSettings.getByRole( 'button', { name: 'Content' } )
		).toBeVisible();
	} );

	test( 'hides the blocks that cannot be interacted with in List View', async ( {
		editor,
		page,
		pageUtils,
	} ) => {
		await editor.setContent( '' );

		// Insert a section with a nested block and an editable block.
		await editor.insertBlock( {
			name: 'core/group',
			attributes: {},
			innerBlocks: [
				{
					name: 'core/group',
					attributes: {
						metadata: {
							name: 'Non-content block',
						},
					},
					innerBlocks: [
						{
							name: 'core/paragraph',
							attributes: {
								content: 'Something',
							},
						},
					],
				},
			],
		} );

		// Select the inner paragraph block so that List View is expanded.
		await editor.canvas
			.getByRole( 'document', {
				name: 'Block: Paragraph',
			} )
			.click();

		// Open List View.
		await pageUtils.pressKeys( 'access+o' );
		const listView = page.getByRole( 'treegrid', {
			name: 'Block navigation structure',
		} );
		const nonContentBlock = listView.getByRole( 'link', {
			name: 'Non-content block',
		} );

		await expect( nonContentBlock ).toBeVisible();

		// Switch to write mode.
		await editor.switchEditorTool( 'Write' );

		await expect( nonContentBlock ).toBeHidden();
	} );
} );
