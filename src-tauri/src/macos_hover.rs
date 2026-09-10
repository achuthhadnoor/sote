//! Keep CSS/JS hover working while the app is not the frontmost app (macOS).
//!
//! WebKit only updates mouseover / `:hover` when `-[NSWindow isKeyWindow]` is
//! true. Spoof that for our main window by replacing `NSWindow`'s IMP and
//! forwarding all other windows to the saved original (never `object_setClass`,
//! and never `msg_send` to a private selector — that breaks subclasses like
//! `TUINSWindow`). Also install an `ActiveAlways` tracking area on the WKWebView.

#![cfg(target_os = "macos")]

use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};
use std::sync::OnceLock;

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Bool, Sel};
use objc2::{sel, AnyThread, ClassType, MainThreadMarker, Message};
use objc2_app_kit::{NSTrackingArea, NSTrackingAreaOptions, NSView, NSWindow};
use objc2_foundation::NSRect;
use tauri::WebviewWindow;

type IsKeyWindowImp = unsafe extern "C-unwind" fn(*mut AnyObject, Sel) -> Bool;

/// Pointer identity of the window that should report isKeyWindow=YES.
static HOVER_WINDOW: AtomicUsize = AtomicUsize::new(0);
/// Original `-[NSWindow isKeyWindow]` IMP (erased).
static ORIGINAL_IS_KEY: AtomicPtr<()> = AtomicPtr::new(std::ptr::null_mut());

fn mark_hover_window(window: &NSWindow) {
    HOVER_WINDOW.store(window as *const NSWindow as usize, Ordering::SeqCst);
}

fn is_hover_window(this: *mut AnyObject) -> bool {
    this as usize == HOVER_WINDOW.load(Ordering::SeqCst)
}

unsafe extern "C-unwind" fn snipnote_is_key_window(this: *mut AnyObject, cmd: Sel) -> Bool {
    if is_hover_window(this) {
        return Bool::YES;
    }
    let orig = ORIGINAL_IS_KEY.load(Ordering::SeqCst);
    debug_assert!(!orig.is_null());
    let f: IsKeyWindowImp = std::mem::transmute(orig);
    f(this, cmd)
}

fn swizzle_nswindow_is_key() {
    static SWIZZLED: OnceLock<()> = OnceLock::new();
    let _ = SWIZZLED.get_or_init(|| {
        let cls = NSWindow::class();
        let Some(method) = cls.instance_method(sel!(isKeyWindow)) else {
            return;
        };
        let original = method.implementation();
        ORIGINAL_IS_KEY.store(
            original as *mut (),
            Ordering::SeqCst,
        );
        let replacement: IsKeyWindowImp = snipnote_is_key_window;
        unsafe {
            method.set_implementation(std::mem::transmute::<IsKeyWindowImp, unsafe extern "C-unwind" fn()>(
                replacement,
            ));
        }
    });
}

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
    static INSTALLED: OnceLock<usize> = OnceLock::new();
    let key = view as *const NSView as usize;
    if INSTALLED.get() == Some(&key) {
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
    let _ = INSTALLED.set(key);
}

fn enable_on_native(ns_window: &NSWindow, ns_view: &NSView) {
    ns_window.setAcceptsMouseMovedEvents(true);

    swizzle_nswindow_is_key();
    mark_hover_window(ns_window);

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
        let _ = window
            .clone()
            .run_on_main_thread(move || enable_inactive_hover(&window));
        return;
    }

    unsafe {
        let ns_window = &*(ns_window_ptr as *const NSWindow);
        let ns_view = &*(ns_view_ptr as *const NSView);
        enable_on_native(ns_window, ns_view);
    }
}
