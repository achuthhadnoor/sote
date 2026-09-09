//! Keep CSS/JS hover working while the app is not the frontmost app (macOS).
//!
//! WKWebView only synthesizes mouse-move / `:hover` while the window is key
//! unless an `NSTrackingArea` with `ActiveAlways` is installed. Always-on-top
//! / narrow side windows need that so the outline rail can expand on hover.

#![cfg(target_os = "macos")]

use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{AnyThread, MainThreadMarker};
use objc2_app_kit::{NSTrackingArea, NSTrackingAreaOptions, NSView, NSWindow};
use objc2_foundation::NSRect;
use tauri::WebviewWindow;

pub fn enable_inactive_hover(window: &WebviewWindow) {
    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let Ok(ns_view_ptr) = window.ns_view() else {
        return;
    };
    if ns_window_ptr.is_null() || ns_view_ptr.is_null() {
        return;
    }

    // NSWindow / NSView APIs are main-thread only.
    if MainThreadMarker::new().is_none() {
        let window = window.clone();
        let _ = window.clone().run_on_main_thread(move || enable_inactive_hover(&window));
        return;
    }

    unsafe {
        let ns_window = &*(ns_window_ptr as *const NSWindow);
        let ns_view = &*(ns_view_ptr as *const NSView);

        ns_window.setAcceptsMouseMovedEvents(true);

        let options = NSTrackingAreaOptions::ActiveAlways
            | NSTrackingAreaOptions::MouseMoved
            | NSTrackingAreaOptions::MouseEnteredAndExited
            | NSTrackingAreaOptions::InVisibleRect
            | NSTrackingAreaOptions::EnabledDuringMouseDrag;

        // InVisibleRect → rect can be zero; area tracks the view's visible bounds.
        let tracking: Retained<NSTrackingArea> = NSTrackingArea::initWithRect_options_owner_userInfo(
            NSTrackingArea::alloc(),
            NSRect::ZERO,
            options,
            Some(&*(ns_view as *const NSView as *const AnyObject)),
            None,
        );
        ns_view.addTrackingArea(&tracking);
    }
}
