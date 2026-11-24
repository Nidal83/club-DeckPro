# Nidal-ClubDeck-pro

Version 1.5.0 of the portable Windows DJ mixer. Mix local audio with the classic jog platters, per-deck FX and crossfader, or cue a YouTube link in its official player. The desktop version can also open YouTube's own watch page inside the mixer window. Watch-page playback uses YouTube's controls and is separate from the deck effects.

![Classic mixer](screenshots/classic-mixer.png)

## Run from source

Install the dependencies with `npm ci`. Run `npm run dev` for the browser mixer, or `npm run desktop:dev` for the Electron app.

## Build for USB

On Windows, run `npm run desktop:usb`. Extract the resulting ZIP to a USB drive and launch `Nidal-ClubDeck-pro.exe` from the extracted folder. Keep the adjacent files with it. See [the portable build notes](PORTABLE_USB.md).
