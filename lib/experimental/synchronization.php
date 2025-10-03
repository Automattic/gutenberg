<?php
/**
 * Bootstraps synchronization (collaborative editing).
 *
 * @package gutenberg
 */

/**
 * Initializes the collaborative editing secret.
 */
function gutenberg_rest_api_init_collaborative_editing() {
	$gutenberg_experiments = get_option( 'gutenberg-experiments' );
	if ( ! $gutenberg_experiments || ! array_key_exists( 'gutenberg-sync-collaboration', $gutenberg_experiments ) ) {
		return;
	}
	$collaborative_editing_secret = get_site_option( 'collaborative_editing_secret' );
	if ( ! $collaborative_editing_secret ) {
		$collaborative_editing_secret = wp_generate_password( 64, false );
	}
	add_site_option( 'collaborative_editing_secret', $collaborative_editing_secret );

	wp_add_inline_script( 'wp-sync', 'window.__experimentalCollaborativeEditingSecret = "' . $collaborative_editing_secret . '";', 'before' );
}
add_action( 'admin_init', 'gutenberg_rest_api_init_collaborative_editing' );

/**
 * Add support for collaborative editing to some built-in post types.
 */
function gutenberg_add_collaborative_editing_post_type_support() {
	$gutenberg_experiments = get_option( 'gutenberg-experiments' );
	if ( ! $gutenberg_experiments || ! array_key_exists( 'gutenberg-sync-collaboration', $gutenberg_experiments ) ) {
		return;
	}

	/*
	 * Filter the post types that support collaborative editing.
	 * By default, only 'post' and 'page' support it.
	 *
	 * @param array $post_types Array of post type names.
	 * @return array Filtered array of post type names.
	 */
	$post_types = apply_filters( 'collaborative_editing_post_types', array( 'page', 'post' ) );

	foreach ( $post_types as $post_type ) {
		if ( post_type_exists( $post_type ) ) {
			add_post_type_support( $post_type, 'collaborative-editing' );
		}
	}
}
add_action( 'init', 'gutenberg_add_collaborative_editing_post_type_support', 10, 0 );
