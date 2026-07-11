using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using NovaSim.Infrastructure;

namespace NovaSim.UI
{
    public partial class App : Avalonia.Application
    {
        public override void Initialize()
        {
            AvaloniaXamlLoader.Load(this);
            // Link clean architecture infrastructure layers to core references
            NovaSim.Application.Services.InfrastructureReference.Logger = NovaSim.Infrastructure.Logging.Logger.Instance;
            NovaSim.Application.Services.InfrastructureReference.EventBus = NovaSim.Infrastructure.Events.EventBus.Instance;
            NovaSim.Application.Services.InfrastructureReference.ConfigManager = NovaSim.Infrastructure.Config.ConfigManager.Instance;
        }

        public override void OnFrameworkInitializationCompleted()
        {
            if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
            {
                desktop.MainWindow = new MainWindow();
            }

            base.OnFrameworkInitializationCompleted();
        }
    }
}
