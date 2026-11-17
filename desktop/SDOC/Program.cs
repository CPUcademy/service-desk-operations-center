using sdoc;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => options.ServiceName = "SDOCAgent");
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
