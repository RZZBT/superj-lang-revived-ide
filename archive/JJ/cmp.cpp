#include <iostream>
#include <cmath>
#include <fstream>
#include <string>
#include <cstdlib>
#include <cstdio>
#include <array>
#include "cmp.hpp"

std::string filePath;

void CleanUp(){
    system("rm writer.cpp");
}

void BeginWriting(std::string code){
    std::ofstream writter;
    writter.open("writer.cpp");
    if(writter.is_open()){
        writter<<"#include <iostream>"<<"\n#include <cmath>";
        writter<<"\nint main(){";

        for(int i = 0;i<code.size();i++){
            if(code[i]=='p'){
                checkKeyword(code,i,writter);
            }                   
        }

        writter<<"\n}";
        writter.close();
        std::cout << "Gata\n";
        system("g++ writer.cpp -o JJexe");
        //CleanUp();
    }
    else{
        std::cerr << "Cannot open the writter\n";
        return;
    }
}


int main(int argc, char* argv[]){

    for(int i=0;i<argc;i++){
        if(i==1){
            std::string tmp = argv[i];
            if(tmp[tmp.size()-2]=='.' && tmp[tmp.size()-1]=='j'){
                goto Init;
            }else{
                std::cerr << "Bro what type of file is that? (should be .j) Bye\n";
                return 0;
            }
        }
    }
    return 0;

Init:
    
    std::ifstream reader;
    std::string codeBuf;
    reader.open("test.j");

    if(reader.is_open()){
        std::string tmpBuf;
        while(reader.eof() == false){
            reader>>tmpBuf;
            codeBuf+=tmpBuf;
        }
    
    }else{
        std::cerr<<"Cannot open file\n";
        return 0;
    }

    reader.close();

    std::cout << "Got that, begin processing!\n";


    BeginWriting(codeBuf);

    return 0;

}