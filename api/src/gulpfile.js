var gulp = require('gulp'),
  nodemon = require('gulp-nodemon'),
  plumber = require('gulp-plumber'),
  livereload = require('gulp-livereload');

var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');

gulp.task('lint', function () {
  return gulp
      .src(['gulpfile.js', 'src/**/*.js', 'test/**/*.js'])
      .pipe(jshint())
      .pipe(jshint.reporter('default'));
});

gulp.task('test', function () {
  return gulp
      .src('test/**/*.js')
      .pipe(mocha())
      .once('end', function () {
          process.exit();
      });
});

gulp.task('mocha', ['lint', 'test'], function () {
  gulp.watch(['src/*.js', 'test/*.js'], function () {
    gulp.run('lint', 'test');
  });
});

gulp.task('develop', function () {
  livereload.listen();
  nodemon({
    script: 'app.js',
    ext: 'js coffee swig',
  }).on('restart', function () {
    setTimeout(function () {
      livereload.changed(__dirname);
    }, 500);
  });
});

gulp.task('default', [
  'develop'
]);
