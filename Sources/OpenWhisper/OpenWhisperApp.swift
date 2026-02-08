// OpenWhisperApp.swift
// Menu bar app with MenuBarExtra, integrated HotkeyMonitor and AudioTranscriber

import SwiftUI

@preconcurrency import SwiftWhisper

@main
struct OpenWhisperApp: App {
    @State private var transcriber = AudioTranscriber()
    @State private var hotkeyMonitor = HotkeyMonitor()
    @State private var showSettings = false
    @State private var isActive = false

    var body: some Scene {
        MenuBarExtra(isInserted: true, content: {
            menuContent
        }, placement: .automatic) {
            statusIndicator
        }
        .menuBarExtraStyle(.window)
        
        WindowGroup("Settings", isPresented: $showSettings) {
            SettingsView(transcriber: transcriber)
        }
        .windowResizability(.contentSize)
    }
    
    private var menuContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OpenWhisper")
                .font(.headline)
            
            Button(isActive ? "Stop Dictation" : "Start Dictation") {
                toggleDictation()
            }
            .keyboardShortcut(.space, modifiers: [])
            
            Button("Copy Transcription") {
                transcriber.copyToClipboard()
            }
            
            Button("Clear Transcription") {
                transcriber.clearTranscription()
            }
            
            Divider()
            
            Button("Settings…") {
                showSettings = true
            }
            
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
        }
        .padding()
        .frame(minWidth: 200)
    }
    
    private var statusIndicator: some View {
        HStack(spacing: 4) {
            Image(systemName: isActive ? "mic.fill" : "mic")
                .foregroundStyle(isActive ? .red : .secondary)
            Text(transcriber.statusMessage)
                .font(.caption)
        }
        .menuBarExtraStyle(.iconOnly)
    }
    
    init() {
        hotkeyMonitor.setHandler { [weak self] in
            self?.toggleDictation()
        }
        hotkeyMonitor.start()
        transcriber.requestPermissions()
        // Observe changes
        observeHotkeyChanges()
    }
    
    private func toggleDictation() {
        transcriber.toggleRecording()
        isActive = transcriber.isRecording
    }
    
    private func observeHotkeyChanges() {
        // Listen for AppStorage changes (simplified, use onAppear or publisher in practice)
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            hotkeyMonitor.updateConfig(
                required: parseModifiers($requiredRaw.wrappedValue),
                forbidden: parseModifiers($forbiddenRaw.wrappedValue),
                key: $hotkeyKey.wrappedValue
            )
        }
    }
    
    private func parseModifiers(_ raw: String) -> NSEvent.ModifierFlags {
        var flags: NSEvent.ModifierFlags = []
        for part in raw.components(separatedBy: ",") {
            let trimmed = part.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            switch trimmed {
            case "command", "cmd": flags.insert(.command)
            case "shift": flags.insert(.shift)
            case "option", "alt": flags.insert(.option)
            case "control", "ctrl": flags.insert(.control)
            case "capslock": flags.insert(.capsLock)
            default: break
            }
        }
        return flags
    }
}

extension AudioTranscriber {
    func copyToClipboard() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(transcription, forType: .string)
    }
}
