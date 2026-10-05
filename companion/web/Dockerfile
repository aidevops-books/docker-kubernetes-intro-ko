FROM nginx:1.27-alpine

ENV API_UPSTREAM=api:3000
COPY default.conf.template /etc/nginx/templates/default.conf.template

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80
