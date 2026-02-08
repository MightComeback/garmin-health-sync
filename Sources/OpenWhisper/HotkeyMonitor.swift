import AppKit
import ApplicationServices
import Carbon.HIToolbox

/// Global hotkey monitor implemented via `CGEventTap`.
///
/// Notes:
/// - Requires Accessibility permission (System Settings → Privacy & Security → Accessibility).
/// - Default hotkey: Cmd+Shift+Space.
final class HotkeyMonitor: @unchecked Sendable, ObservableObject {
    weak var transcriber: AudioTranscriber?

    private var requiredFlags: CGEventFlags = [.maskCommand, .maskShift]
    private var forbiddenFlags: CGEventFlags = [.maskAlternate, .maskControl]
    private var keyCode: CGKeyCode = CGKeyCode(kVK_Space)

    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?

    init() {
        loadConfig()
        start()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(configChanged),
            name: UserDefaults.didChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        stop()
    }

    func setTranscriber(_ transcriber: AudioTranscriber) {
        self.transcriber = transcriber
    }

    @objc private func configChanged() {
        loadConfig()
    }

    private func loadConfig() {
        let defaults = UserDefaults.standard
        let requiredRaw = defaults.string(forKey: "hotkey.required") ?? "command,shift"
        let forbiddenRaw = defaults.string(forKey: "hotkey.forbidden") ?? "option,control"
        let keyRaw = defaults.string(forKey: "hotkey.key") ?? "space"

        updateConfig(
            required: parseFlags(requiredRaw),
            forbidden: parseFlags(forbiddenRaw),
            key: keyRaw
        )
    }

    private func parseFlags(_ raw: String) -> CGEventFlags {
        var flags: CGEventFlags = []
        for part in raw.components(separatedBy: ",") {
            let trimmed = part.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            switch trimmed {
            case "command", "cmd": flags.insert(.maskCommand)
            case "shift": flags.insert(.maskShift)
            case "option", "alt": flags.insert(.maskAlternate)
            case "control", "ctrl": flags.insert(.maskControl)
            case "capslock": flags.insert(.maskAlphaShift)
            default: break
            }
        }
        return flags
    }

    func updateConfig(required: CGEventFlags, forbidden: CGEventFlags, key: String) {
        requiredFlags = required
        forbiddenFlags = forbidden
        keyCode = Self.keyCode(for: key) ?? CGKeyCode(kVK_Space)

        stop()
        start()
    }

    func start() {
        requestAccessibilityIfNeeded()

        guard eventTap == nil else { return }

        let eventsOfInterest = CGEventMask(1 << CGEventType.keyDown.rawValue)

        let callback: CGEventTapCallBack = { proxy, type, event, refcon in
            guard let refcon else {
                return Unmanaged.passUnretained(event)
            }
            let monitor = Unmanaged<HotkeyMonitor>.fromOpaque(refcon).takeUnretainedValue()
            return monitor.handle(proxy: proxy, type: type, event: event)
        }

        let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: eventsOfInterest,
            callback: callback,
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        )

        guard let tap else {
            // If we fail to install the tap, most likely Accessibility permission is missing.
            return
        }

        eventTap = tap
        let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        runLoopSource = source
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
    }

    func stop() {
        if let source = runLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes)
            runLoopSource = nil
        }
        if let tap = eventTap {
            CFMachPortInvalidate(tap)
            eventTap = nil
        }
    }

    private func handle(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        switch type {
        case .tapDisabledByTimeout, .tapDisabledByUserInput:
            if let tap = eventTap {
                CGEvent.tapEnable(tap: tap, enable: true)
            }
            return Unmanaged.passUnretained(event)
        case .keyDown:
            break
        default:
            return Unmanaged.passUnretained(event)
        }

        let flags = event.flags
        let hasRequired = flags.intersection(requiredFlags) == requiredFlags
        let hasForbidden = !flags.intersection(forbiddenFlags).isEmpty
        guard hasRequired, !hasForbidden else {
            return Unmanaged.passUnretained(event)
        }

        let pressedKeyCode = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
        guard pressedKeyCode == keyCode else {
            return Unmanaged.passUnretained(event)
        }

        DispatchQueue.main.async { [weak self] in
            self?.transcriber?.toggleRecording()
        }

        // Swallow the key event to avoid typing (e.g. space) into the focused app.
        return nil
    }

    private func requestAccessibilityIfNeeded() {
        let options: CFDictionary = [
            kAXTrustedCheckOptionPrompt.takeUnretainedValue() as CFString: kCFBooleanTrue
        ] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
    }

    private static func keyCode(for raw: String) -> CGKeyCode? {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if key == "space" || key == " " { return CGKeyCode(kVK_Space) }
        if key == "return" || key == "enter" { return CGKeyCode(kVK_Return) }
        if key == "tab" { return CGKeyCode(kVK_Tab) }
        if key == "escape" || key == "esc" { return CGKeyCode(kVK_Escape) }

        // Single ASCII letters/digits.
        if key.count == 1, let scalar = key.unicodeScalars.first {
            switch scalar {
            case "a": return CGKeyCode(kVK_ANSI_A)
            case "b": return CGKeyCode(kVK_ANSI_B)
            case "c": return CGKeyCode(kVK_ANSI_C)
            case "d": return CGKeyCode(kVK_ANSI_D)
            case "e": return CGKeyCode(kVK_ANSI_E)
            case "f": return CGKeyCode(kVK_ANSI_F)
            case "g": return CGKeyCode(kVK_ANSI_G)
            case "h": return CGKeyCode(kVK_ANSI_H)
            case "i": return CGKeyCode(kVK_ANSI_I)
            case "j": return CGKeyCode(kVK_ANSI_J)
            case "k": return CGKeyCode(kVK_ANSI_K)
            case "l": return CGKeyCode(kVK_ANSI_L)
            case "m": return CGKeyCode(kVK_ANSI_M)
            case "n": return CGKeyCode(kVK_ANSI_N)
            case "o": return CGKeyCode(kVK_ANSI_O)
            case "p": return CGKeyCode(kVK_ANSI_P)
            case "q": return CGKeyCode(kVK_ANSI_Q)
            case "r": return CGKeyCode(kVK_ANSI_R)
            case "s": return CGKeyCode(kVK_ANSI_S)
            case "t": return CGKeyCode(kVK_ANSI_T)
            case "u": return CGKeyCode(kVK_ANSI_U)
            case "v": return CGKeyCode(kVK_ANSI_V)
            case "w": return CGKeyCode(kVK_ANSI_W)
            case "x": return CGKeyCode(kVK_ANSI_X)
            case "y": return CGKeyCode(kVK_ANSI_Y)
            case "z": return CGKeyCode(kVK_ANSI_Z)

            case "0": return CGKeyCode(kVK_ANSI_0)
            case "1": return CGKeyCode(kVK_ANSI_1)
            case "2": return CGKeyCode(kVK_ANSI_2)
            case "3": return CGKeyCode(kVK_ANSI_3)
            case "4": return CGKeyCode(kVK_ANSI_4)
            case "5": return CGKeyCode(kVK_ANSI_5)
            case "6": return CGKeyCode(kVK_ANSI_6)
            case "7": return CGKeyCode(kVK_ANSI_7)
            case "8": return CGKeyCode(kVK_ANSI_8)
            case "9": return CGKeyCode(kVK_ANSI_9)

            default:
                return nil
            }
        }

        return nil
    }
}
