FROM mongo:2.6.11

RUN mkdir /import
WORKDIR /import
ADD /dump /import/quiz

#RUN mongorestore .

EXPOSE 27017
