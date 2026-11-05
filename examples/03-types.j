// The data types from syn.txt:  datatype name : value;   or   datatype name {value}
whl(1) small : 250;      // natural number, 1 byte
int count : -7;          // integer, 4 bytes by default
rat third {rat(1) / 3};  // exact rational (a plain 1/3 would be whole division = 0)
real ratio : 2.5;
nr anything : 4;         // generic number
const answer : 42;       // type decided from the value
txt name : "SuperJ";
char initial : 'J';
state ready : true;

small : small + 10;      // whl(1) is one byte: 250 + 10 wraps to 4
print("small =",,small.);
print("count =",,count.);
print("third =",,third.);
print("ratio =",,ratio.);
print("anything =",,anything.);
print("answer =",,answer.);
print(name,,initial,,ready.);
