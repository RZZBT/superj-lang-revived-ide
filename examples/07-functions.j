// Name(params){code}  is accessible from anywhere.
// Name(params){}!(functions);  is only accessible from those functions.
int total : 0;

add(int amount, int times = 1){
    int k : 0;
    while(k < times){
        total : total + amount;
        k : k + 1;
    }
}

show(){
    log("total is");
}

log(txt label){
    print(label,,total.);
}!(show);          // only show() may call log()

add(5);
add(2, 10);
show();
// log("not allowed");   <- would be a transpile error
