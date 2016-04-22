FROM node:4.2.4

RUN npm install bower -g
RUN npm install gulp -g
RUN npm install -g mocha
RUN mkdir /src

WORKDIR /src
ADD package.json /src/package.json
RUN npm install

ADD /bower_components /src/bower_components
ADD bower.json /src/bower.json

ENV NODE_ENV development

EXPOSE 3010
EXPOSE 35729
WORKDIR /src/app
CMD gulp develop
