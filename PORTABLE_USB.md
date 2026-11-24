# Nidal-ClubDeck-pro Portable USB Build

For faster USB startup, build the Windows folder edition with `npm.cmd run desktop:usb`.
Extract `Nidal-ClubDeck-pro-USB-1.5.0.zip` once into a folder on the USB.
Launch `Nidal-ClubDeck-pro.exe` inside that folder and keep the adjacent files with it.
This edition runs directly from the folder on each launch.

## Build

```powershell
npm.cmd run desktop:portable
```

The generated executable is written to:

```text
C:\tmp\clubdeck-pro-release\Nidal-ClubDeck-pro-Portable-1.5.0.exe
```

## Use

- Run the single-file executable on a Windows PC when you prefer a self-extracting package.
- The app starts its own private local server and opens the DJ mixer in a desktop window.
- Use the **Visualizer** button to open the projector screen.
- YouTube playback still requires internet access and videos that allow embedded playback.
- Supabase features still require the configured Supabase environment values.

## Notes

- This is a portable app, not an installer.
- No Node.js or npm installation is required on the party computer.
- Windows may show a SmartScreen warning because the executable is not code-signed.
