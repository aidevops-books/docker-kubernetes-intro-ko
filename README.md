# Docker & Kubernetes 최신 입문 - 2026 — 실습 자료

『Docker & Kubernetes 최신 입문 - 2026』(John Bae 지음, AIDevOps Cloud Native Series #03) 한글판의 공식 실습 자료입니다.
책에서 `companion/...`으로 가리키는 모든 파일이 이 저장소의 `companion/` 폴더에 같은 경로로 들어 있습니다.

- 도서 소개와 목차: <https://www.aidevops.kr/books/docker-kubernetes-intro/>
- 같은 자료의 ZIP: <https://www.aidevops.kr/downloads/books/docker-kubernetes-intro/companion-ko.zip>

## 이 자료로 하는 일

작은 애플리케이션 **Mini CloudShop** 하나를 처음부터 끝까지 사용합니다.
Nginx 웹 페이지(Web)가 Express API를 호출하고, API는 Redis의 카운터를 증가시킵니다.
같은 세 구성 요소를 단일 Container → Compose → Swarm → Kubernetes 순서로 실행하면서 무엇이 달라지는지 확인합니다.

모든 실습은 **Docker가 설치된 컴퓨터 한 대**에서 진행합니다. 클라우드 계정이나 별도 서버는 필요하지 않고,
Kubernetes 실습은 [kind](https://kind.sigs.k8s.io/)로 만든 로컬 Cluster에서 실행합니다.

## 받는 방법

```bash
git clone https://github.com/aidevops-books/docker-kubernetes-intro-ko.git
cd docker-kubernetes-intro-ko/companion
```

Git을 쓰지 않는다면 위의 ZIP을 받아 압축을 풀어도 내용이 같습니다.
이 문서의 명령은 따로 적지 않는 한 `companion/` 폴더에서 실행합니다.

## 준비물

| 도구 | 필요한 장 | 확인 명령 |
|---|---|---|
| Docker Engine과 Compose v2 (Docker Desktop이면 함께 설치됨) | 전체 | `docker version`, `docker compose version` |
| kind | 15~21장, 부록 E | `kind version` |
| kubectl | 15~21장, 부록 E | `kubectl version --client` |
| Helm | 19~20장 (Traefik 설치) | `helm version` |

책의 실습은 Docker 29, kind v0.33, Kubernetes v1.37.0, Traefik Helm Chart 41.6.0에서 실행해 확인했습니다.
다른 버전에서는 출력이나 옵션이 조금 다를 수 있으니, 차이가 보이면 사용하는 버전의 공식 문서를 함께 확인하세요.

## 폴더 구성

```text
companion/
├── api/                  Express API (server.js, package.json)
│   ├── Dockerfile          기본 Image (6장)
│   ├── Dockerfile.secure   Multi-stage · non-root · HEALTHCHECK (10장)
│   └── .dockerignore       로컬 node_modules가 Image에 섞이지 않게 한다
├── web/                  Nginx 웹 페이지와 /api 프록시 템플릿
├── compose.yaml          Web · API · Redis와 Redis 데이터용 Volume (9장)
├── swarm/                3-Node Swarm 실습 (14장)
├── k8s/                  Kubernetes 매니페스트 (16~20장)
│   ├── app/                Mini CloudShop 전체 배포 (20장)
│   └── broken/             일부러 망가뜨린 매니페스트 4개 (부록 E)
├── LEARNING_RECORD.md    학습 완료 점검표와 실험 기록지
└── README.md             실습 순서 요약
```

## 장별 파일 안내

| 장 | 파일 | 하는 일 |
|---|---|---|
| 6장 | `api/` | API를 Image로 빌드하고 Container로 실행합니다. |
| 7장 | `api/server.js` | Redis 연동이 들어 있는 API입니다. Network로 API와 Redis를 연결합니다. |
| 8장 | `compose.yaml`의 `redis-data` | Container를 교체해도 Redis 데이터가 남는지 확인합니다. |
| 9장 | `compose.yaml`, `web/` | 세 서비스를 Compose로 한 번에 실행합니다. |
| 10장 | `api/Dockerfile.secure` | Multi-stage Build, `USER node`, `HEALTHCHECK`를 적용한 Image를 만듭니다. |
| 14장 | `swarm/` | Docker 안에 Node 세 개를 띄워 Swarm의 자동 복구와 Rollback을 확인합니다. |
| 16장 | `k8s/pod.yaml`, `k8s/deployment.yaml` | 단독 Pod와 Deployment를 비교합니다. |
| 17장 | `k8s/service.yaml` | 바뀌는 Pod 앞에 고정된 이름과 주소를 둡니다. |
| 18장 | `k8s/config.yaml`, `k8s/deployment-config.yaml`, `k8s/redis.yaml`, `k8s/emptydir-pod.yaml` | ConfigMap·Secret, PVC를 쓰는 Redis, emptyDir을 비교합니다. |
| 19장 | `k8s/ingress.yaml` | Traefik으로 외부 요청을 Service까지 연결합니다. |
| 20장 | `k8s/app/` | Compose로 실행하던 애플리케이션 전체를 Kubernetes에 배포합니다. |
| 부록 E | `k8s/broken/` | Pending, ImagePullBackOff, OOMKilled, 설정 누락 장애를 만들고 진단합니다. |

`api/`와 `web/`의 코드는 7~9장을 마친 상태입니다. 6장의 단순한 API에는 없는 Redis 연동과 `/ready` 경로가 포함되어 있습니다.

## 실습 가이드

### 1. Compose로 전체 실행하기 (9장)

```bash
docker compose config
docker compose up -d --build
docker compose ps
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/count
```

- Web: <http://localhost:8080> — 버튼을 누르면 `/api/count`를 호출합니다.
- API 직접 확인: `http://localhost:3000/health`

API의 세 경로는 서로 다른 것을 알려 줍니다.

| 경로 | 의미 |
|---|---|
| `/health` | API 프로세스가 응답하는가 |
| `/ready` | Redis에 연결할 준비가 되었는가 |
| `/api/count` | 실제로 카운터가 증가하는가 (Redis가 준비되지 않았으면 503) |

끝낼 때는 두 명령의 차이를 구분합니다.

```bash
docker compose down       # Container와 Network만 지운다. Redis 데이터는 남는다
docker compose down -v    # Volume까지 지운다. Redis 데이터가 사라진다
```

### 2. 개선한 Image 빌드하기 (10장)

```bash
docker build -f api/Dockerfile.secure -t intro-api:secure ./api
```

### 3. 3-Node Swarm 실습 (14장, 선택)

Docker 안에서 Docker Engine 세 개(manager1, worker1, worker2)와 Registry를 실행합니다. 서버 세 대가 필요하지 않습니다.
전체 절차는 [`companion/swarm/README.md`](companion/swarm/README.md)에 있습니다.

### 4. kind Cluster 만들기 (15장)

```bash
kind create cluster --name intro --wait 2m
kubectl config current-context    # kind-intro
```

### 5. Image를 빌드해 Node에 넣기 (16, 20장)

kind의 Node는 Docker Container라서 호스트의 Image 목록을 볼 수 없습니다. 빌드한 Image를 `kind load`로 전달합니다.

```bash
docker build -t intro-api:1.0 ./api
docker build -t intro-web:1.0 ./web
kind load docker-image intro-api:1.0 intro-web:1.0 --name intro
```

코드나 템플릿을 고친 뒤에는 Image를 다시 빌드하고 다시 load합니다.

### 6. 매니페스트 적용하기 (16~19장)

`k8s/` 폴더로 이동해 장 순서대로 적용합니다.

```bash
cd k8s
kubectl apply -f pod.yaml            # 16장
kubectl apply -f deployment.yaml     # 16장
kubectl apply -f service.yaml        # 17장
kubectl apply -f config.yaml         # 18장
kubectl apply -f deployment-config.yaml
kubectl apply -f redis.yaml
```

19장의 `ingress.yaml`은 Ingress Controller가 있어야 동작합니다. Helm으로 Traefik을 설치합니다.

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm upgrade --install traefik traefik/traefik --version 41.6.0 \
  --namespace traefik --create-namespace \
  --set providers.kubernetesIngress.enabled=true \
  --set providers.kubernetesGateway.enabled=false \
  --set service.spec.type=ClusterIP
kubectl apply -f ingress.yaml
kubectl port-forward -n traefik svc/traefik 8080:80
```

로컬 kind에는 외부 Load Balancer가 없으므로 Traefik의 Service를 ClusterIP로 두고 `port-forward`로 접속합니다.

### 7. Mini CloudShop 전체 배포하기 (20장)

이전 장에서 만든 자원을 정리한 뒤 `app/` 폴더 전체를 적용합니다.

```bash
kubectl delete -f ingress.yaml -f redis.yaml -f config.yaml -f service.yaml -f deployment-config.yaml --ignore-not-found
kubectl apply -f app/
kubectl port-forward -n traefik svc/traefik 8080:80
```

Service 이름은 Compose와 같게 `web`, `api`, `redis`로 지었습니다.
`app/config.yaml`의 `REDIS_PORT: "6379"`는 반드시 유지하세요. 빠뜨리면 Kubernetes가 자동으로 넣는 `REDIS_PORT=tcp://...` 값이 쓰여 API가 시작하지 못합니다(부록 E에서 직접 재현합니다).

### 8. 장애 만들고 진단하기 (부록 E)

`broken/` 폴더의 파일은 일부러 문제를 넣은 것입니다.

```bash
kubectl apply -f broken/pending.yaml -f broken/imagepull.yaml -f broken/oom.yaml
kubectl get pods
kubectl describe pod <이름>
```

| 파일 | 만들어지는 상태 |
|---|---|
| `broken/pending.yaml` | Node에 없는 자원을 요청해 `Pending` |
| `broken/imagepull.yaml` | 존재하지 않는 Tag로 `ImagePullBackOff` |
| `broken/oom.yaml` | 메모리 제한을 넘겨 `OOMKilled` |
| `broken/config-no-redis-port.yaml` | `REDIS_PORT`를 빠뜨려 API가 `CrashLoopBackOff` |

실습을 마치면 적용한 파일을 지웁니다.

### 9. 정리하기

```bash
kind delete cluster --name intro
```

Cluster를 지우면 실습에서 만든 Kubernetes 자원이 모두 사라집니다. 4번부터 다시 시작할 수 있습니다.

## 실습 기록 남기기

[`companion/LEARNING_RECORD.md`](companion/LEARNING_RECORD.md)에 학습 완료 점검표와 실험 기록지 양식이 있습니다.
환경, 가설, 증거, 변경 내용, 복구 판정을 남기되 실제 비밀번호나 토큰은 적지 마세요.

## 알아 둘 점

- 이 코드는 학습용 예제입니다. 실제 운영 환경에 적용하기 전에 사용하는 Docker·Kubernetes 버전의 공식 문서와 대조하세요.
- 매니페스트의 Secret 값(`change-me-in-real-life` 등)은 예제용이며 실제 비밀 값이 아닙니다.
- 책의 예시 출력에 나오는 Pod 이름, 시각, 카운터 값은 환경마다 다릅니다. 출력 문자열이 똑같은지보다 설명한 상태 변화와 응답 조건을 만족하는지로 판단하세요.
- kind는 학습용 로컬 Cluster입니다. 외부 Load Balancer나 여러 서버에 걸친 장애 같은 운영 환경의 조건은 다루지 않습니다.

## 다음 책

이 책은 Kubernetes Learning Series의 Volume 1입니다.

| 학습 순서 | 도서 |
|---|---|
| Volume 1 | Docker & Kubernetes 최신 입문 - 2026 (이 책) |
| Volume 2 | [Kubernetes의 이해와 실습](https://www.aidevops.kr/books/kubernetes-understanding-practice/) |
| Volume 3 | [Kubernetes Production Engineering](https://www.aidevops.kr/books/kubernetes-production-engineering/) |

Volume 2에서도 이 저장소의 `api/`, `web/`으로 만든 `intro-api:1.0`, `intro-web:1.0` Image를 사용합니다.

## 라이선스

Copyright © 2026 John Bae

- **실습 코드** (매니페스트, Dockerfile, 스크립트, 설정, 예제 애플리케이션 소스): [MIT License](LICENSE). 저작권 표시를 유지하면 자유롭게 쓰고 고칠 수 있습니다.
- **설명 글** (이 README를 포함한 모든 Markdown 문서): [CC BY-NC-ND 4.0](LICENSE-docs). 출처를 밝히고, 비영리 목적으로, 내용을 바꾸지 않을 때 공유할 수 있습니다. 문서 안에 적힌 명령과 코드 조각은 실습 코드와 같이 MIT로 쓸 수 있습니다.
- **책 본문과 그림**은 이 저장소에 들어 있지 않으며 모든 권리를 보유합니다.

예제가 사용하는 Container Image, Helm Chart 등 다른 프로젝트의 소프트웨어는 각 프로젝트의 라이선스를 따릅니다.

---

AIDevOps — <https://www.aidevops.kr>
