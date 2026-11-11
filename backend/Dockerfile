FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline

COPY src ./src

RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/*.jar app.jar

RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8002

ENV JAVA_OPTS="-Xms128m -Xmx224m -XX:ReservedCodeCacheSize=32m -XX:+UseSerialGC -Xss256k"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
