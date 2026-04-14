# 🏗️ Diagrama de Infraestrutura — Pasto Livre

## Arquitetura Completa (Fluxo de Requisição + CI/CD)

```mermaid
flowchart TB
    subgraph INTERNET["🌐 Internet"]
        USER["👤 Usuário Final"]
        DEV["👨‍💻 Desenvolvedor"]
        GITLAB["🦊 GitLab (Repositório)"]
        DOCKERHUB["🐳 Docker Hub (Registry)"]
    end

    subgraph CLOUDFLARE["☁️ Cloudflare"]
        DNS["📡 DNS\npastolivre.eduardotartas.dpdns.org"]
        TUNNEL["🔒 Cloudflare Tunnel\n(cloudflared)"]
    end

    subgraph OCI["🏢 Oracle Cloud Infrastructure (ARM64 / Ampere)"]
        subgraph K3S["⚙️ Cluster K3s (Kubernetes Leve)"]

            subgraph NS_PL["📦 Namespace: pasto-livre"]
                TRAEFIK["🔀 Traefik\n(Ingress Controller)"]
                INGRESS["📋 IngressRoute\n(Regras de Roteamento)"]
                SVC_API["🔌 Service (ClusterIP)\nAPI"]
                SVC_DB["🔌 Service (ClusterIP)\nPostgreSQL"]

                subgraph DEPLOY_API["🚀 Deployment: API"]
                    POD_API1["📦 Pod API\n(Node.js)"]
                end

                subgraph DEPLOY_DB["💾 StatefulSet: PostgreSQL"]
                    POD_DB["📦 Pod PostgreSQL"]
                    PV["💿 PersistentVolume\n(Dados)"]
                end
            end

            subgraph NS_RUNNER["📦 Namespace: gitlab-runner"]
                RUNNER["🏃 GitLab Runner\n(CI/CD Executor)"]
            end
        end
    end

    %% ===== FLUXO DE REQUISIÇÃO (Usuário → API) =====
    USER -->|"1️⃣ HTTPS Request"| DNS
    DNS -->|"2️⃣ Resolve + Proxy"| TUNNEL
    TUNNEL -->|"3️⃣ Túnel Seguro\n(sem portas abertas)"| TRAEFIK
    TRAEFIK -->|"4️⃣ Avalia IngressRoute"| INGRESS
    INGRESS -->|"5️⃣ Roteia para Service"| SVC_API
    SVC_API -->|"6️⃣ Load Balance"| POD_API1
    POD_API1 -->|"7️⃣ Query SQL"| SVC_DB
    SVC_DB --> POD_DB
    POD_DB --- PV

    %% ===== FLUXO DE CI/CD (Deploy Automatizado) =====
    DEV -->|"A. git push"| GITLAB
    GITLAB -->|"B. Trigger Pipeline"| RUNNER
    RUNNER -->|"C. docker build\n(linux/arm64)"| DOCKERHUB
    RUNNER -->|"D. kubectl set image\n+ rollout status"| DEPLOY_API

    %% Estilos
    classDef internet fill:#1a1a2e,stroke:#e94560,color:#fff
    classDef cloudflare fill:#f48c06,stroke:#e85d04,color:#fff
    classDef oci fill:#0f3460,stroke:#16213e,color:#fff
    classDef k3s fill:#1a1a40,stroke:#533483,color:#fff
    classDef namespace fill:#1e3a5f,stroke:#4cc9f0,color:#fff
    classDef service fill:#2d6a4f,stroke:#52b788,color:#fff
    classDef pod fill:#3a0ca3,stroke:#7209b7,color:#fff
    classDef runner fill:#6a040f,stroke:#dc2f02,color:#fff

    class USER,DEV,GITLAB,DOCKERHUB internet
    class DNS,TUNNEL cloudflare
    class TRAEFIK,INGRESS service
    class SVC_API,SVC_DB service
    class POD_API1,POD_DB,PV pod
    class RUNNER runner
```

---

## Fluxo de CI/CD Detalhado (Pipeline GitLab)

```mermaid
sequenceDiagram
    actor Dev as 👨‍💻 Desenvolvedor
    participant GL as 🦊 GitLab
    participant Runner as 🏃 GitLab Runner<br/>(dentro do K3s)
    participant DH as 🐳 Docker Hub
    participant K3s as ⚙️ Cluster K3s
    participant API as 📦 Pod API

    Dev->>GL: 1. git push (branch main)
    GL->>Runner: 2. Dispara Pipeline CI/CD
    
    rect rgb(40, 40, 80)
        Note over Runner,DH: 🔨 Stage: Build
        Runner->>Runner: 3. docker buildx build<br/>--platform linux/arm64
        Runner->>DH: 4. docker push<br/>(imagem multi-arch)
    end
    
    rect rgb(20, 60, 40)
        Note over Runner,API: 🚀 Stage: Deploy
        Runner->>K3s: 5. kubectl set image<br/>deployment/gerenciamento-rural-api
        K3s->>K3s: 6. Cria novo Pod com imagem atualizada
        K3s->>API: 7. Health Check do novo Pod
        API-->>K3s: 8. Pod Ready ✅
        K3s->>K3s: 9. Termina Pod antigo (Rolling Update)
        Runner->>K3s: 10. kubectl rollout status<br/>(aguarda conclusão)
        K3s-->>Runner: 11. Rollout completo ✅
    end
    
    Runner-->>GL: 12. Pipeline Success ✅
    GL-->>Dev: 13. Notificação de sucesso
```

---

## Fluxo de Requisição do Usuário

```mermaid
sequenceDiagram
    actor User as 👤 Usuário
    participant CF as ☁️ Cloudflare DNS
    participant Tunnel as 🔒 Cloudflare Tunnel
    participant Traefik as 🔀 Traefik<br/>(Ingress Controller)
    participant SVC as 🔌 Service API<br/>(ClusterIP)
    participant API as 📦 Pod Node.js
    participant DB as 💾 PostgreSQL

    User->>CF: 1. GET https://pastolivre.eduardotartas.dpdns.org/api
    CF->>CF: 2. Resolve DNS + Proxy Cloudflare
    CF->>Tunnel: 3. Encaminha via túnel seguro
    
    Note over Tunnel: Sem portas abertas!<br/>Conexão outbound do cluster
    
    Tunnel->>Traefik: 4. Entrega requisição ao Ingress
    Traefik->>Traefik: 5. Avalia IngressRoute<br/>(Host + Path matching)
    Traefik->>SVC: 6. Roteia para Service correto
    SVC->>API: 7. Encaminha para Pod disponível
    
    API->>DB: 8. Query SQL (Prisma ORM)
    DB-->>API: 9. Resultado da query
    
    API-->>SVC: 10. Resposta JSON
    SVC-->>Traefik: 11. Response
    Traefik-->>Tunnel: 12. Response
    Tunnel-->>CF: 13. Response via túnel
    CF-->>User: 14. 200 OK + JSON Response
```

---

## Estrutura dos Namespaces no Cluster

```mermaid
graph LR
    subgraph K3S["⚙️ Cluster K3s"]
        direction TB
        subgraph NS1["📦 pasto-livre"]
            direction LR
            A["🔀 Traefik"] --> B["📋 IngressRoute"]
            B --> C["🔌 SVC API :3000"]
            C --> D["🚀 Deployment API<br/>NODE_ENV=production"]
            E["🔌 SVC PostgreSQL :5432"] --> F["💾 Pod PostgreSQL<br/>+ PersistentVolume"]
            D -.->|"Prisma ORM"| E
        end
        subgraph NS2["📦 gitlab-runner"]
            G["🏃 GitLab Runner<br/>(registered + overwrite)"]
        end
        G -.->|"kubectl"| D
    end

    style NS1 fill:#0d1b2a,stroke:#4cc9f0,color:#fff
    style NS2 fill:#1b0a2a,stroke:#c77dff,color:#fff
    style K3S fill:#0a0a1a,stroke:#533483,color:#fff
```

---

> [!NOTE]
> **Segurança**: Nenhuma porta é aberta no firewall da Oracle ou no roteador. Todo o tráfego externo passa pelo Cloudflare Tunnel, que mantém uma conexão **outbound** do cluster para a Cloudflare.

> [!TIP]
> **Após cada deploy**, faça um **Hard Refresh** (`Ctrl+Shift+R`) no navegador para limpar o cache e carregar os arquivos mais recentes.
