// while(condition), break, skip
int i : 0;
while(i < 10){
    i : i + 1;
    if(i % 2 == 0){ skip; }     // skip the even numbers
    if(i > 7){ break; }
    print(i,,);
}
print(.);

// a while can be given a name for goto:   while(condition) |name
int count : 0;
while(count < 3) |counting {
    count : count + 1;
}
print("counted to",,count.);
