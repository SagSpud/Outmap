Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "dist\Shandong3D-GIS-win32-x64"
WshShell.Run "Shandong3D-GIS.exe", 1, False
