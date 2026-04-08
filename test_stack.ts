function c() {
    console.log(new Error().stack);
}
function b() {
    c();
}
function a() {
    b();
}
a();

