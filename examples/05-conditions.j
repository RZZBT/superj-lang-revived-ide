// if(state)  \elif()  \else()
int n : 0;
if(n < 0){
    print("negative".);
} \elif(n == 0){
    print("zero".);
} \else(){
    print("positive".);
}

// if(state)(bool do_all = true): every branch that is true runs, not just the first
int x : 10;
if(x > 1)(bool do_all = true){
    print("x > 1".);
} \elif(x > 5){
    print("x > 5".);
} \elif(x > 50){
    print("x > 50".);
} \else(){
    print("(else only runs when nothing matched)".);
}
