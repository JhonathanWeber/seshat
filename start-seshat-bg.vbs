Set WshShell = CreateObject("WScript.Shell")

' Build the absolute path to the batch file
strBatchPath = "D:\workspace\th0th\th0th-main\start-api.bat"

' 1. Start the actual backend services (API + Ollama) silently using cmd /c
' This ensures the batch file environment is correctly initialized
WshShell.Run "cmd /c " & chr(34) & strBatchPath & chr(34), 0, True

' 2. The batch file now handles browser opening, so we don't need to do it here
' unless we want to ensure it opens after the batch completes.
' However, the batch file is running in background (Run ..., 0, True waits for it).

Set WshShell = Nothing
