<?php

function render_block_core_legacy_widget( $attributes ) {
	return json_encode( $attributes );
}

function register_block_core_legacy_widget() {
	register_block_type_from_metadata(
		__DIR__ . '/legacy-widget',
		array(
			'render_callback' => 'render_block_core_legacy_widget',
		)
	);
}

add_action( 'init', 'register_block_core_legacy_widget' );
