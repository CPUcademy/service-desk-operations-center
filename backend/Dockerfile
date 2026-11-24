FROM mcr.microsoft.com/dotnet/sdk:10.0 AS agent

RUN apt-get update && apt-get install -y --no-install-recommends zip && rm -rf /var/lib/apt/lists/*

WORKDIR /agent
COPY desktop/SDOC/ ./
RUN dotnet publish SDOC.csproj -c Release -f net10.0-windows -r win-x64 --self-contained -o /agent/win \
    && dotnet publish SDOC.csproj -c Release -f net10.0 -r linux-x64 --self-contained -o /agent/linux \
    && sed -i 's/\r$//' /agent/linux/install-worker.sh \
    && chmod +x /agent/linux/install-worker.sh /agent/linux/SDOC \
    && cd /agent/win && zip -qr /agent/sdoc-worker.zip . \
    && tar -czf /agent/sdoc-worker-linux.tar.gz -C /agent/linux .

FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /build

COPY backend/pom.xml .
RUN mvn dependency:go-offline

COPY backend/src ./src

RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/*.jar app.jar
COPY --from=agent /agent/sdoc-worker.zip /agent/sdoc-worker-linux.tar.gz /app/worker/

RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8002

ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:ReservedCodeCacheSize=32m -XX:+UseSerialGC -Xss256k"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
