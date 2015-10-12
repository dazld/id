'use strict';
let _ = require('lodash');

let gulp = require('gulp');
let plumber = require('gulp-plumber');
let gutil = require('gulp-util');
let gulpif = require('gulp-if');
let watch = require('gulp-watch');
let notify = require('gulp-notify');
let debug = require('gulp-debug');
let size = require('gulp-size');

let sass = require('gulp-sass');
let csso = require('gulp-csso');
let autoprefixer = require('gulp-autoprefixer');

let spawn = require('child_process').spawn;
let resolve = require('path').resolve;
let join = require('path').join;

let connect = require('gulp-connect');
let connectLivereload = require('connect-livereload');
let livereload = require('gulp-livereload');

let browserify = require('browserify');
let watchify = require('watchify');
let babelify = require('babelify');
let envify = require('envify/custom');
let source = require('vinyl-source-stream');
let buffer = require('vinyl-buffer');

const ALL_SASS = ['./assets/sass/**/*.scss'];
const ALL_HTML = ['./assets/**/*.html'];
const ALL_IMG = './assets/img/**/*.{png|svg|jpg|jpeg}'

const BROWSER_CONFIG = ['> 1%','IE 9'];
const STATIC_BASE = __dirname;
const STATIC_FOLDER = join(STATIC_BASE, 'static');
const CSS_FOLDER = join(STATIC_FOLDER, 'css');
const JS_FOLDER = join(STATIC_FOLDER, 'js');
const IMG_FOLDER = join(STATIC_FOLDER, 'img');
const IS_DEV = process.env.NODE_ENV !== 'production';

const LIVERELOAD_PORT = process.env.LIVERELOAD_PORT || 32766;
const SERVER_PORT = process.env.SERVER_PORT || 8080;

// js compilation
const browserifyOptions = {
    entries: ['app/index.js'],
    debug: IS_DEV
};

const opts = _.assign({}, watchify.args, browserifyOptions);
const compiler = IS_DEV ? watchify(browserify(opts)) : browserify(opts);

compiler.transform(babelify);

compiler.transform(envify({
    global: true,
    NODE_ENV: process.env.NODE_ENV,
    _: 'purge'
},{
    global: true
}));

function bundle() {
    return compiler.bundle()
        .on('error', notify.onError('Error: <%= error.message %>'))
        .on('error', function(error) {
            gutil.log(gutil.colors.red(error.stack));
            gutil.log(gutil.colors.red('Error: (' + error.plugin + ') - ' + error.message));
            this.emit('end');
        })
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(notify('Compiled: <%= file.relative %>'))
        .pipe(size())
        .pipe(debug())
        .pipe(gulp.dest(JS_FOLDER))
        .pipe(livereload());
}

compiler.on('update', function(){
    bundle();
});

compiler.on('log', gutil.log);
gulp.task('client', bundle);



// compiling dev sass to static folder
function compileSass(){
    return gulp.src(ALL_SASS)
        .pipe(debug())
        .pipe(sass().on('error', sass.logError))
        .pipe(csso())
        .pipe(autoprefixer({
            cascade: false
        }))
        .pipe(size())
        .pipe(debug())
        .pipe(gulp.dest(CSS_FOLDER))
        .pipe(livereload());
}
gulp.task('sass', compileSass);


// copying dev html to static folder
function html(){
    return gulp.src(ALL_HTML)
        .pipe(debug())
        .pipe(gulp.dest(STATIC_FOLDER))
        .pipe(livereload());
}
gulp.task('html', html);

// images
function images(){
    return gulp.src(ALL_IMG)
            .pipe(debug())
            .pipe(size())
            .pipe(gulp.dest(IMG_FOLDER))
            .pipe(livereload());
}
gulp.task('img', images);

// dev server
function mountFolder(server, dir){
    return server.static(resolve(dir));
}

function makeServer(){
    connect.server({
        root: STATIC_FOLDER,
        port: SERVER_PORT,
        middleware: function(server){
            return [
                function(req,res,next){
                    const isImage = (req.headers.accept.indexOf('image') !== -1);
                    if (isImage) {
                        res.setHeader('Expires', new Date(Date.now() + 86400000));
                        res.setHeader('Last-modified',  new Date(Date.now() + 86400000));
                        res.setHeader('Cache-Control', 'public');
                    }
                    next();
                },
                connectLivereload({
                    port: LIVERELOAD_PORT
                }),
                mountFolder(server, STATIC_FOLDER)
            ];
        }
    })
}
gulp.task('serve', makeServer);



// watch for changes
gulp.task('watch', ['sass','html'], function(){
    watch(ALL_SASS, function(file) {
        gutil.log('sass update');
        compileSass();
    });
    watch(ALL_HTML, function(file){
        gutil.log('html update');
        html();
    });
    watch(ALL_IMG, function(){
        gutil.log('image update');
        images();
    })
    livereload.listen({
        port: LIVERELOAD_PORT
    });
});


//  default task
gulp.task('default', ['sass','html','img','client','watch','serve']);

