using sdoc;

if (args.Length == 4 && args[0] == "--desktop")
{
    await DesktopHelper.RunAsync(args);
    return;
}

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => options.ServiceName = AgentClient.ServiceName);
builder.Services.AddHostedService<Worker>();
builder.Services.AddHostedService<AgentClient>();

var host = builder.Build();
host.Run();
