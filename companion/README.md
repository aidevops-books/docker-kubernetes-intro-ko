# Docker 입문 동반 프로젝트

이 폴더에서 `docker compose up -d --build`를 실행한다. Docker 엔진이 실행 중이어야 한다. Web은 `http://localhost:8080`, API 직접 점검은 `http://localhost:3000/health`를 사용한다. 카운터 버튼은 같은 출처의 `/api/count`를 호출하고 Web Nginx가 API로 전달한다.

이 코드는 7~9장을 마친 상태의 예제다. 6장의 단순 API에 없는 Redis 연동과 `/ready` 경로가 포함된다. `/health`는 프로세스 응답, `/ready`는 Redis 연결 준비 상태이며 실제 카운터 증가도 따로 확인한다. Redis가 준비되지 않았으면 `/api/count`는 503을 반환한다.

```bash
docker compose config
docker compose up -d --build
docker compose ps
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/count
```

Web의 `default.conf.template`은 API 경로를 바꾸지 않는다. API_UPSTREAM 기본값은 `api:3000`이며, Kubernetes Web Deployment에서는 `cloudshop-api:80`으로 지정한다. 코드나 템플릿 변경 뒤에는 Image를 다시 빌드한다.

Redis 데이터 보존 실습은 작은 테스트 key를 저장하고 `redis-cli SAVE`의 OK를 확인한 뒤 Container를 교체한다. `docker compose down`과 Volume까지 지우는 `down -v`를 구분한다. 현재 예제는 로컬 학습용이며 실클러스터 재검증 범위는 출판 검증 보고서를 참고한다.

10장의 개선 Image는 `api/Dockerfile.secure`로 빌드한다: `docker build -f api/Dockerfile.secure -t intro-api:secure ./api`. Multi-stage Build, `USER node`, `HEALTHCHECK`가 적용되어 있다. `api/.dockerignore`는 로컬 `node_modules`가 Image에 섞이지 않게 한다.

4권으로 연결할 때는 `docker build -t intro-api:1.0 ./api`, `docker build -t intro-web:1.0 ./web`으로 Image를 만들고, 해당 kind Cluster에 두 Image를 load한다.

## Kubernetes 실습 (15~20장, 부록 E)

`k8s/` 폴더의 파일은 kind 학습용 Cluster(`kind create cluster --name intro`)를 기준으로 한다. Node가 호스트의 Image를 볼 수 없으므로 먼저 `kind load docker-image intro-api:1.0 intro-web:1.0 --name intro`를 실행한다.

- 16장: `pod.yaml`, `deployment.yaml`
- 17장: `service.yaml`
- 18장: `config.yaml`, `deployment-config.yaml`, `emptydir-pod.yaml`, `redis.yaml`
- 19장: `ingress.yaml` (Traefik 설치 뒤 동작)
- 20장: `app/` 폴더 전체를 `kubectl apply -f app/`로 적용. Service 이름을 Compose와 같게(`web`, `api`, `redis`) 지었으며, `REDIS_PORT: "6379"`는 반드시 유지한다(Kubernetes가 넣는 `REDIS_PORT=tcp://...` 때문, 부록 E).
- 부록 E: `broken/` 폴더의 파일은 일부러 문제를 넣은 것이다. 실습 뒤 지운다.

검증 환경: kind v0.33, Kubernetes v1.37.0, Traefik Helm Chart 41.6.0.

