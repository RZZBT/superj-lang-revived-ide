// rat is exact: no 0.333333 here
rat sum : 0;
int k : 1;
while(k <= 5){
    sum : sum + rat(1) / k;      // 1/1 + 1/2 + 1/3 + 1/4 + 1/5
    k : k + 1;
}
print("1 + 1/2 + 1/3 + 1/4 + 1/5 =",,sum.);
print("numerator",,getUp(sum),,"denominator",,getDown(sum).);
print("as a real:",,getUp(sum) / 1.0 / getDown(sum).);
