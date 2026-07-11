using System;

namespace NovaSim.Core.Interfaces
{
    public record EventPayload(DateTime Timestamp, string Sender, object? Data = null);

    public interface IEventBus
    {
        Action Subscribe(string @event, Action<EventPayload> callback);
        Action SubscribeAll(Action<string, EventPayload> callback);
        void Publish(string @event, string sender, object? data = null);
        void ClearAllListeners();
    }
}
