# 14장 선택 실습 — 3-Node Swarm으로 Orchestration 확인하기

본문 14.3절의 "여러 Node에서 확인한 네 가지 사실"을 직접 재현하는 전체 절차다. 한 대의 컴퓨터에서 Docker-in-Docker Container 세 개(manager1, worker1, worker2)와 실습 Registry로 3-Node Swarm을 만든다. 학습 전용 구성이며 `privileged` 권한을 사용하므로 운영 환경에서 쓰지 않는다.

- 검증 환경: Docker Desktop 4.60.1(Docker 29.2) 호스트, 노드 Image `docker:29-dind`(Engine 29.8.1), `registry:3`.
- 명령은 이 `companion/swarm` 폴더에서 실행한다. `docker exec manager1 docker ...`는 "manager1 Host에서 docker 명령을 실행한다"는 뜻이다.
- 호스트 포트는 8090이다(9장 Compose의 8080과 겹치지 않게). Windows에서는 `localhost` 대신 `127.0.0.1`을 쓴다.

## 1. Node 세 개와 Registry 시작

```bash
docker compose -f lab-nodes.yaml up -d
docker exec manager1 docker info --format '{{.ServerVersion}}'
```

두 번째 명령이 오류를 내면 안쪽 Docker Engine이 시작 중인 것이므로 몇 초 뒤 다시 실행한다.

## 2. Swarm 만들고 Worker 참여

```bash
docker exec manager1 docker swarm init
docker exec manager1 docker swarm join-token -q worker
docker exec worker1 docker swarm join --token <TOKEN> manager1:2377
docker exec worker2 docker swarm join --token <TOKEN> manager1:2377
docker exec manager1 docker node ls
```

```text
HOSTNAME   STATUS    AVAILABILITY   MANAGER STATUS   ENGINE VERSION
manager1   Ready     Active         Leader           29.8.1
worker1    Ready     Active                          29.8.1
worker2    Ready     Active                          29.8.1
```

## 3. 사실 1 — Registry 없이 실행해 보기

호스트의 Image를 manager1에만 전달한다. 파일로 저장해 복사하면 운영체제와 셸에 관계없이 동작한다(Windows PowerShell 5.1의 파이프는 이진 데이터를 손상시킬 수 있다).

```bash
docker save -o intro-images.tar intro-api:1.0 intro-web:1.0
docker cp intro-images.tar manager1:/intro-images.tar
docker exec manager1 docker load -i /intro-images.tar
docker exec manager1 docker service create --name api-local --replicas 3 intro-api:1.0
```

다른 터미널에서 Task 이력을 본다.

```bash
docker exec manager1 docker service ps api-local --no-trunc --format '{{.Name}} {{.Node}} {{.CurrentState}} {{.Error}}'
```

Worker의 Task가 `Rejected ... pull access denied for intro-api`로 반복해서 거부된다. 확인했으면 지운다.

```bash
docker exec manager1 docker service rm api-local
```

## 4. Registry에 올리고 Stack 배포

```bash
docker exec manager1 docker tag intro-api:1.0 registry:5000/intro-api:1.0
docker exec manager1 docker push registry:5000/intro-api:1.0
docker exec manager1 docker tag intro-web:1.0 registry:5000/intro-web:1.0
docker exec manager1 docker push registry:5000/intro-web:1.0
docker exec worker1 wget -qO- http://registry:5000/v2/_catalog
docker cp stack.yaml manager1:/stack.yaml
docker exec manager1 docker stack deploy --detach=false -c /stack.yaml shop
docker exec manager1 docker stack ps shop --format 'table {{.Name}}\t{{.Node}}\t{{.CurrentState}}'
curl http://127.0.0.1:8090/api/count
```

API Task가 세 Node에 나뉘고, Redis는 `placement.constraints`에 따라 manager1에서 실행된다. Web Task가 없는 Node에서도 `docker exec worker2 wget -qO- http://127.0.0.1:8080/api/count`가 응답한다(Routing Mesh).

## 5. 사실 2·3 — Node 장애와 복구

```bash
docker exec manager1 docker service scale shop_api=5
docker stop worker2
# 약 25초 뒤
docker exec manager1 docker node ls --format '{{.Hostname}} {{.Status}}'
docker exec manager1 docker service ls --format '{{.Name}} {{.Replicas}}'
curl http://127.0.0.1:8090/api/count
docker start worker2
docker exec manager1 docker service ps shop_api --filter desired-state=running --format '{{.Name}} {{.Node}}'
docker exec manager1 docker service update --force --detach=false shop_api
```

worker2가 `Down`이 되면 Task가 다른 Node로 옮겨 가고 `shop_api 7/5`가 잠시 보인다. worker2가 돌아와도 Task는 옮겨 오지 않으며, `--force` 갱신 뒤에 다시 고르게 나뉜다.

## 6. 사실 4 — 실패한 배포와 자동 Rollback

```bash
docker exec manager1 docker service update --image registry:5000/intro-api:9.9 --detach=false shop_api
docker exec manager1 docker service inspect shop_api --format 'image={{.Spec.TaskTemplate.ContainerSpec.Image}} state={{.UpdateStatus.State}}'
```

```text
image=registry:5000/intro-api:1.0@sha256:bceb1681c180... state=rollback_completed
```

## 7. 정리

```bash
docker exec manager1 docker stack rm shop
docker compose -f lab-nodes.yaml down -v
rm intro-images.tar
```

Windows PowerShell에서는 마지막 줄을 `Remove-Item intro-images.tar`로 실행한다. `down -v`는 세 Node와 그 안의 데이터, 실습 Registry를 함께 지운다.
