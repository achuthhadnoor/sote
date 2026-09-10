//! Keep mouse-move / CSS `:hover` delivery healthier on inactive windows (macOS).
//!
//! Installs `acceptsMouseMovedEvents` + an `ActiveAlways` tracking area on the
//! WKWebView. Do not spoof `isKeyWindow` via `object_setClass` or process-wide
//! IMP replace — both crash AppKit (KVO / TUINSWindow). WebKit may still gate
//! some `:hover` updates on key-window; accept that until a safe approach exists.

#![cfg(target_os = "macos")]

use std::sync::atomic::{AtomicUsize, Ordering};

use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{AnyThread, MainThreadMarker, Message};
use objc2_app_kit::{NSTrackingArea, NSTrackingAreaOptions, NSView, NSWindow};
use objc2_foundation::NSRect;
use tauri::WebviewWindow;

/// View pointer we last attached a tracking area to (0 = none).
static TRACKING_VIEW: AtomicUsize = AtomicUsize::new(0);

fn is_wkwebview(view: &NSView) -> bool {
    let mut cls = Some(view.class());
    while let Some(c) = cls {
        let name = c.name();
        if name == c"WKWebView" || name == c"WryWebView" {
            return true;
        }
        cls = c.superclass();
    }
    false
}

fn find_wkwebview(view: &NSView) -> Option<Retained<NSView>> {
    if is_wkwebview(view) {
        return Some(view.retain());
    }
    for sub in view.subviews() {
        if let Some(found) = find_wkwebview(&sub) {
            return Some(found);
        }
    }
    None
}

fn install_tracking_area(view: &NSView) {
    let key = view as *const NSView as usize;
    if TRACKING_VIEW.load(Ordering::SeqCst) == key {
        return;
    }

    let options = NSTrackingAreaOptions::ActiveAlways
        | NSTrackingAreaOptions::MouseMoved
        | NSTrackingAreaOptions::MouseEnteredAndExited
        | NSTrackingAreaOptions::InVisibleRect
        | NSTrackingAreaOptions::EnabledDuringMouseDrag;

    let tracking: Retained<NSTrackingArea> = unsafe {
        NSTrackingArea::initWithRect_options_owner_userInfo(
            NSTrackingArea::alloc(),
            NSRect::ZERO,
            options,
            Some(&*(view as *const NSView as *const AnyObject)),
            None,
        )
    };
    view.addTrackingArea(&tracking);
    TRACKING_VIEW.store(key, Ordering::SeqCst);
}

fn enable_on_native(ns_window: &NSWindow, ns_view: &NSView) {
    ns_window.setAcceptsMouseMovedEvents(true);
    let target = find_wkwebview(ns_view).unwrap_or_else(|| ns_view.retain());
    install_tracking_area(&target);
}

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

    if MainThreadMarker::new().is_none() {
        let window = window.clone();
        let result = window
            .clone()
            .run_on_main_thread(move || enable_inactive_hover(&window));
        if result.is_err() {
            #[cfg(debug_assertions)]
            eprintln!("snipnote: enable_inactive_hover main-thread hop failed");
        }
        return;
    }

    unsafe {
        let ns_window = &*(ns_window_ptr as *const NSWindow);
        let ns_view = &*(ns_view_ptr as *const NSView);
        enable_on_native(ns_window, ns_view);
    }
}
