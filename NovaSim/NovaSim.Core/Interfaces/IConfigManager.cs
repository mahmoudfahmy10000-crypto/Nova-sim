using NovaSim.Core.Config;

namespace NovaSim.Core.Interfaces
{
    public interface IConfigManager
    {
        NovaSimConfig GetConfig();
        void LoadProfile(string profile);
        void UpdateConfig(NovaSimConfig newConfig);
    }
}
