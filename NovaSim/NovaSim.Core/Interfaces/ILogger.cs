using System;
using System.Collections.Generic;
using NovaSim.Core.Enums;

namespace NovaSim.Core.Interfaces
{
    public interface ILogEntry
    {
        string Id { get; }
        DateTime Timestamp { get; }
        LogLevel Level { get; }
        string Category { get; }
        string Message { get; }
        Exception? Exception { get; }
    }

    public interface ILogger
    {
        void Configure(LogLevel minLevel, bool enableConsole, bool enableRingBuffer, int ringBufferCapacity);
        void Trace(string message, string category = "GENERAL");
        void Debug(string message, string category = "GENERAL");
        void Info(string message, string category = "GENERAL");
        void Warn(string message, string category = "GENERAL");
        void Error(string message, Exception? exception = null, string category = "GENERAL");
        void Fatal(string message, Exception? exception = null, string category = "GENERAL");
        
        IReadOnlyList<ILogEntry> GetRingBuffer();
        void ClearRingBuffer();
        event Action<ILogEntry>? OnLog;
    }
}
