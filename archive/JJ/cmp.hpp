#include <iostream>
#include <cmath>
#include <fstream>
#include <string>
#include <cstdlib>
#include <cstdio>
#include <array>
#include <map>
#include <sstream>


int convertStringToInt(std::string string){

    int returnInt;

    for(int i=0;i<string.size();i++){

        if(48<=string[i]&&string[i]<=57){
            switch (string[i])
            {
                     case 57:{
                returnInt*=10;
                returnInt+=9;
                break;}
                       case 56:{
                returnInt*=10; 
                returnInt+=8;
                break;}
                       case 55:{
                returnInt*=10;
                returnInt+=7;
                break;}
                       case 54:{
                returnInt*=10;
                returnInt+=6;
                break;}
                       case 53:{
                returnInt*=10;
                returnInt+=5;
                break;}
                       case 52:{
                returnInt*=10;
                returnInt+=4;
                break;}
                       case 51:{
                returnInt*=10;
                returnInt+=3;
                break;}
                       case 50:{
                returnInt*=10;
                returnInt+=2;
                break;}
                       case 49:{
                returnInt*=10;
                returnInt+=1;
                break;}
                       case 48:{
                returnInt*=10;
                returnInt+=0;
                break;}
            
            default:
                break;
            }
        }

    }
    return returnInt;
}

int deFormatSize(std::string word){

    int result = 0;
    std::string strinTo;

    for(int i=word.size();i>0;i--){
        if(word[i]=='"'){
            break;
        }
        strinTo+=word[i];
    }

    result = convertStringToInt(strinTo);

    return result;

}

std::string breakHeader(std::string word){
    std::string returnStr = "";
    bool exitFirst {false};
    bool readyToRead {false};
    for(int i =word.size();i>=0;i--){
        if(readyToRead == true){
            returnStr+=word[i];
        }
        if(word[i]=='"'&&exitFirst==false){
            exitFirst = true;
            continue;
        }
        if(word[i]=='"'&&exitFirst==true){
            readyToRead = true;
        }
    }
    std::string tempStr = "";
    for(int i = returnStr.size()-1;i>=0;i--){
        tempStr+=returnStr[i];
    }
    return tempStr;
}

std::string u_code;
std::ofstream* writter;

std::string print(int index){
    std::string toCout {};
    bool inText = false;
    for(int i = index+1;i<u_code.size();i++){

        if(u_code[i-1]==',' && u_code[i]==','&&inText==false){
            toCout+='"'; toCout+=' '; toCout+='"';
            continue;
        }
        if(u_code[i]==','&&inText==false){
            toCout+=" << ";
            continue;
        }
        if(u_code[i]=='.'&&inText==false){
            toCout+="<<std::endl";
            continue;
        }
        if(u_code[i]=='"'){
            inText=!inText;
        }
        if(u_code[i]==')'&&inText==false){
            break;
        }
        toCout+=u_code[i];
    }
    *writter<<"\nstd::cout<<"<<toCout<<";";
    return "completed";
}

std::string whl(int index){
    std::string toWrite {};
    bool inParant = false;
    std::string byteSize {};
    for(int i =index+1;i<u_code.size();i++){
        if(u_code[index+1]=='('){
            inParant=true;            
            continue;
        }
        if(u_code[i]==')'){
            inParant=false;
            continue;
        }
        if(inParant==true){
            byteSize+=u_code[i];
        }
        if(inParant==false){
            toWrite+=u_code[i];
        }

    }

    *writter<< " int a = 3";

    return "completed";
}

std::string k_5(std::string keyWord){


    if(breakHeader(keyWord)=="print"){
        return print(deFormatSize(keyWord));
    }

    return "null";

}

std::string k_3(std::string keyWord){

    if(breakHeader(keyWord)=="whl"){
        return whl(deFormatSize(keyWord));
    }

    return "null";

}

std::string syntaxChecker(std::string keyword){


    int size = deFormatSize(keyword);

    switch (size)
    {
        case 5:{
            return k_5(keyword);
            break;
        }
        case 3:{
            return k_3(keyword);
            break;
        }
    }

    return "null";
}

std::string checkKeyword(std::string code, int index,std::ofstream &ostream){
    writter=&ostream;
    u_code = code;
    std::string returnStr;
    std::string word;
    int tempIndex;
    for(int i = index;i<=4+index;i++){

        word+=code[i];
        tempIndex = i;
    }
    returnStr+=word;
    returnStr+='"';
    returnStr+=tempIndex;
    returnStr+='"';
    returnStr+=std::to_string(word.size());
    return syntaxChecker(returnStr);
}

// print"32"5;

