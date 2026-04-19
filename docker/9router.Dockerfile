FROM node:20-bookworm-slim

WORKDIR /srv/9router

RUN npm install -g 9router

EXPOSE 20128

CMD ["9router", "--host", "0.0.0.0", "--port", "20128", "--no-browser", "--skip-update"]
